import { NextResponse } from "next/server";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getServerAuth } from "@/lib/server-auth";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate limit: 60 logs per minute per user
        if (!checkRateLimit(`logs_${user.uid}`, 60, 60000)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await request.json();
        const logId = await logServerActivity({
            ...body,
            user_id: user.uid,
            user_role: user.role,
            user_name: user.profile?.full_name || body.user_name || user.email,
            user_email: user.email,
        });

        return NextResponse.json({ success: true, logId });
    } catch (error: any) {
        console.error("Error in /api/logs/record:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
