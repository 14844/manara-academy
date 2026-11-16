import { NextResponse } from "next/server";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getServerAuth } from "@/lib/server-auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limiter";
import { isBackofficeRole } from "@/lib/permissions";

export async function POST(request: Request) {
    try {
        const clientIp = getClientIp(request);
        const user = await getServerAuth(request);

        const rateKey = user ? `logs_${user.uid}` : `logs_anon_${clientIp}`;
        const rateCheck = await checkRateLimitAsync(rateKey, 120, 60);
        if (!rateCheck.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const raw = await request.text();
        if (raw.length > 10 * 1024) {
            return NextResponse.json({ error: "Payload too large" }, { status: 413 });
        }
        let body: any;
        try {
            body = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const safeAction = typeof body.action === "string" && /^[a-z0-9_.:-]{1,64}$/i.test(body.action)
            ? body.action
            : "client_action";

        const validCategories = ["financial", "auth", "admin_action", "course", "system", "client", "ai_support"];
        let safeCategory = typeof body.category === "string" && validCategories.includes(body.category)
            ? body.category
            : "client";

        // Infer category if client set client or generic
        if (safeCategory === "client") {
            if (/^(user_)?(login|signup|auth|session|password)/i.test(safeAction)) {
                safeCategory = "auth";
            } else if (/^(recharge|withdraw|payment|refund|wallet|payout|enroll)/i.test(safeAction)) {
                safeCategory = "financial";
            } else if (/^(admin_)/i.test(safeAction)) {
                safeCategory = "admin_action";
            } else if (/^(course_|lesson_|exam_|quiz_|video_)/i.test(safeAction)) {
                safeCategory = "course";
            }
        }

        // Only admin / staff (backoffice) sessions may file entries under the admin_action category
        if (safeCategory === "admin_action" && !isBackofficeRole(user?.role)) {
            safeCategory = "client";
        }

        const validStatuses = ["success", "failed", "pending", "info"];
        const safeStatus = typeof body.status === "string" && validStatuses.includes(body.status)
            ? body.status
            : (safeAction.includes("failed") || safeAction.includes("error") ? "failed" : "info");

        // Amount parsing
        let safeAmount: number | undefined = undefined;
        if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
            safeAmount = body.amount;
        } else if (typeof body.amount === "string" && !isNaN(Number(body.amount))) {
            safeAmount = Number(body.amount);
        } else if (body.metadata?.amount && !isNaN(Number(body.metadata.amount))) {
            safeAmount = Number(body.metadata.amount);
        } else if (body.metadata?.paid_amount && !isNaN(Number(body.metadata.paid_amount))) {
            safeAmount = Number(body.metadata.paid_amount);
        }

        const ALLOWED_META_KEYS = [
            "page", "path", "course_id", "course_title", "lesson_id", "student_id",
            "request_id", "withdrawal_id", "role", "new_status", "rejection_reason",
            "error_code", "attempted_email", "category", "component", "error",
            "message", "amount", "paid_amount", "amount_added", "email", "transaction_id", "user_id"
        ];
        const safeMetadata: Record<string, string | number | boolean> = {};
        if (typeof body.metadata === "object" && body.metadata !== null && !Array.isArray(body.metadata)) {
            for (const k of ALLOWED_META_KEYS) {
                const v = body.metadata[k];
                if (typeof v === "string") safeMetadata[k] = v.slice(0, 300);
                else if (typeof v === "number" && Number.isFinite(v)) safeMetadata[k] = v;
                else if (typeof v === "boolean") safeMetadata[k] = v;
            }
        }

        // Anonymous visitors may only report auth-related events
        if (!user && !/^(login|signup|auth|user_login|user_signup)/i.test(safeAction)) {
            return NextResponse.json({ success: true });
        }

        const safeTitle = typeof body.title === "string" ? body.title.slice(0, 150) : safeAction;
        const safeDesc = typeof body.description === "string"
            ? body.description.slice(0, 1000)
            : (typeof body.details === "string" ? body.details.slice(0, 1000) : safeAction);

        const safeUserId = user?.uid || (typeof body.user_id === "string" ? body.user_id.slice(0, 128) : "guest");
        const safeUserName = user?.profile?.full_name || (typeof body.user_name === "string" ? body.user_name.slice(0, 100) : (user?.email || "زائر"));
        const safeUserEmail = user?.email || (typeof body.user_email === "string" ? body.user_email.slice(0, 150) : (body.metadata?.email || ""));
        // Role always comes from the server-side session (admin & staff included). Anonymous callers can
        // never claim a privileged role: only student / instructor / guest are accepted from the body.
        const ANON_ALLOWED_ROLES = ["student", "instructor", "guest"];
        const safeUserRole = user
            ? user.role
            : (typeof body.user_role === "string" && ANON_ALLOWED_ROLES.includes(body.user_role) ? body.user_role : "guest");

        const logId = await logServerActivity({
            action: safeAction,
            category: safeCategory as any,
            title: safeTitle,
            description: safeDesc,
            status: safeStatus as any,
            amount: safeAmount,
            metadata: safeMetadata,
            user_id: safeUserId,
            user_role: safeUserRole as any,
            user_name: safeUserName,
            user_email: safeUserEmail,
            target_user_id: typeof body.target_user_id === "string" ? body.target_user_id.slice(0, 128) : undefined,
            target_user_name: typeof body.target_user_name === "string" ? body.target_user_name.slice(0, 100) : undefined,
            error_message: typeof body.error_message === "string" ? body.error_message.slice(0, 500) : undefined,
        });

        return NextResponse.json({ success: true, logId });
    } catch (error: any) {
        console.error("Error in /api/logs/record:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
