import { NextResponse } from "next/server";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getServerAuth } from "@/lib/server-auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limiter";

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

        // Categories reserved for server-generated events ("security", "admin_action", "financial")
        // can NEVER be written from the browser — they are downgraded to "client" so a staff member
        // cannot forge an audit entry that looks like a real server-side action.
        const RESERVED_CATEGORIES = ["security", "admin_action", "financial"];
        const CLIENT_CATEGORIES = ["auth", "course", "system", "client", "ai_support"];
        const requestedCategory = typeof body.category === "string" ? body.category.slice(0, 32) : "";
        let safeCategory = CLIENT_CATEGORIES.includes(requestedCategory) ? requestedCategory : "client";

        // Infer a (non-reserved) category if the client sent a generic one
        if (safeCategory === "client") {
            if (/^(user_)?(login|signup|auth|session|password)/i.test(safeAction)) {
                safeCategory = "auth";
            } else if (/^(course_|lesson_|exam_|quiz_|video_)/i.test(safeAction)) {
                safeCategory = "course";
            }
        }
        if (RESERVED_CATEGORIES.includes(safeCategory)) safeCategory = "client";

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

        // Actor identity comes ONLY from the server-side session. Anonymous callers are always logged
        // as "guest"; whatever identity they claim is kept in metadata (clearly marked as claimed).
        if (requestedCategory && requestedCategory !== safeCategory) safeMetadata.requested_category = requestedCategory;
        if (!user) {
            const claimedEmail = typeof body.user_email === "string" ? body.user_email : (typeof body.metadata?.email === "string" ? body.metadata.email : "");
            if (claimedEmail) safeMetadata.claimed_email = claimedEmail.slice(0, 150);
            if (typeof body.user_id === "string") safeMetadata.claimed_user_id = body.user_id.slice(0, 128);
        }
        const safeUserId = user?.uid || "guest";
        const safeUserName = user ? (user.profile?.full_name || user.email || user.uid) : "زائر";
        const safeUserEmail = user?.email || "";
        const safeUserRole = user ? user.role : "guest";

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
            source: "client",
        }, request);

        return NextResponse.json({ success: true, logId });
    } catch (error: any) {
        console.error("Error in /api/logs/record:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
