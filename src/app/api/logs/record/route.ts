import { NextResponse } from "next/server";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getServerAuth } from "@/lib/server-auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limiter";

export async function POST(request: Request) {
    try {
        const clientIp = getClientIp(request);
        const user = await getServerAuth(request);

        const rateKey = user ? `logs_${user.uid}` : `logs_anon_${clientIp}`;
        const rateCheck = await checkRateLimitAsync(rateKey, 60, 60);
        if (!rateCheck.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const raw = await request.text();
        if (raw.length > 4 * 1024) {
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

        // Allowlist: only simple, bounded fields are accepted from the client
        const safeAction = typeof body.action === "string" && /^[a-z0-9_.:-]{1,64}$/i.test(body.action)
            ? body.action
            : "client_action";
        const safeDetails = typeof body.details === "string" ? body.details.slice(0, 500) : "";
        const ALLOWED_META_KEYS = ["page", "path", "course_id", "course_title", "lesson_id", "student_id", "request_id", "withdrawal_id", "role", "new_status", "rejection_reason", "error_code", "attempted_email", "category", "component", "error", "message"];
        const safeMetadata: Record<string, string | number | boolean> = {};
        if (typeof body.metadata === "object" && body.metadata !== null && !Array.isArray(body.metadata)) {
            for (const k of ALLOWED_META_KEYS) {
                const v = body.metadata[k];
                if (typeof v === "string") safeMetadata[k] = v.slice(0, 200);
                else if (typeof v === "number" && Number.isFinite(v)) safeMetadata[k] = v;
                else if (typeof v === "boolean") safeMetadata[k] = v;
            }
        }

        // Anonymous visitors may only report auth-related events; anything else is accepted but dropped.
        if (!user && !/^(login|signup|auth)/i.test(safeAction)) {
            return NextResponse.json({ success: true });
        }

        // Enforce safe server attributes and strictly category="client"
        const logId = await logServerActivity({
            action: safeAction,
            category: "client",
            title: typeof body.title === "string" ? body.title.slice(0, 100) : safeAction,
            description: safeDetails || (typeof body.description === "string" ? body.description.slice(0, 500) : safeAction),
            status: "info",
            metadata: safeMetadata,
            user_id: user?.uid || "guest",
            user_role: (user?.role as any) || "guest",
            user_name: user?.profile?.full_name || user?.email || "زائر",
            user_email: user?.email || "",
        });

        return NextResponse.json({ success: true, logId });
    } catch (error: any) {
        console.error("Error in /api/logs/record:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
