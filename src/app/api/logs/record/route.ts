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

        // Enforce safe server attributes
        const logId = await logServerActivity({
            ...body,
            user_id: user?.uid || body.user_id || "guest",
            user_role: user?.role || body.user_role || "guest",
            user_name: user?.profile?.full_name || body.user_name || user?.email || "زائر",
            user_email: user?.email || body.user_email || "",
        });

        return NextResponse.json({ success: true, logId });
    } catch (error: any) {
        console.error("Error in /api/logs/record:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
