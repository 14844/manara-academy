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

        const body = await request.json();

        // Reject any financial fields from client
        if (
            body.amount !== undefined ||
            body.balance !== undefined ||
            body.wallet_balance !== undefined ||
            body.price !== undefined ||
            body.instructor_share !== undefined ||
            body.platform_commission !== undefined
        ) {
            return NextResponse.json({ error: "غير مصرح بتسجيل بيانات مالية من العميل" }, { status: 400 });
        }

        // Allowlist and sanitize safe client logging fields
        const safeAction = typeof body.action === "string" ? body.action.slice(0, 100) : "client_action";
        const safeDetails = typeof body.details === "string" ? body.details.slice(0, 500) : "";
        const safeMetadata = typeof body.metadata === "object" && body.metadata !== null && !Array.isArray(body.metadata)
            ? { ...body.metadata }
            : {};

        // Strip any potential financial keys from metadata
        delete safeMetadata.amount;
        delete safeMetadata.balance;
        delete safeMetadata.wallet_balance;
        delete safeMetadata.price;
        delete safeMetadata.instructor_share;
        delete safeMetadata.platform_commission;

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
