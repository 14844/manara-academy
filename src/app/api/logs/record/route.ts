import { NextResponse } from "next/server";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const logId = await logServerActivity(body);
        return NextResponse.json({ success: true, logId });
    } catch (error: any) {
        console.error("Error in /api/logs/record:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
