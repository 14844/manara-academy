import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limiter";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // 1. Validate token format (strictly require >= 32 characters, alphanumeric and dashes)
        if (!token || typeof token !== "string" || token.length < 32 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
            return NextResponse.json({ error: "Invalid report token format" }, { status: 400 });
        }

        // 2. Rate limit by client IP
        const clientIp = getClientIp(request);
        const rateCheck = await checkRateLimitAsync(`parent_report_${clientIp}`, 30, 60);
        if (!rateCheck.success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                { status: 429 }
            );
        }

        const docRef = adminDb.collection("parent_reports").doc(token);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const data = docSnap.data() || {};

        // 3. Always enforce token expiration (default to 30 days max if not explicitly provided)
        const now = Date.now();
        const expiresAtTime = data.expires_at ? new Date(data.expires_at).getTime() : 0;
        const createdAtTime = data.created_at ? new Date(data.created_at).getTime() : now;
        const maxLifetime = 30 * 24 * 60 * 60 * 1000; // 30 days

        if (expiresAtTime > 0) {
            if (now > expiresAtTime) {
                return NextResponse.json({ error: "انتهت صلاحية رابط هذا التقرير" }, { status: 410 });
            }
        } else if (now - createdAtTime > maxLifetime) {
            return NextResponse.json({ error: "انتهت صلاحية رابط هذا التقرير" }, { status: 410 });
        }

        // 4. Return DISPLAY FIELDS ONLY (no sensitive UIDs, phone numbers, or internal metadata)
        const safeReportData = {
            student_name: data.student_name || "طالب",
            student_avatar: data.student_avatar || null,
            course_title: data.course_title || "كورس تعليمي",
            instructor_name: data.instructor_name || "المعلم",
            stats: {
                attendance_rate: data.stats?.attendance_rate || 0,
                completed_lessons_count: data.stats?.completed_lessons_count || 0,
                total_lessons_count: data.stats?.total_lessons_count || 0,
                last_accessed: data.stats?.last_accessed || null,
                progress: data.stats?.progress || 0,
                average_score: data.stats?.average_score || 0,
            },
            exams: Array.isArray(data.exams)
                ? data.exams.map((exam: any) => ({
                      title: exam.title || "اختبار",
                      score: exam.score ?? 0,
                      total_questions: exam.total_questions ?? 0,
                      submitted_at: exam.submitted_at || null,
                  }))
                : [],
            manual_note: data.manual_note || "",
            created_at: data.created_at || new Date().toISOString(),
            expires_at: data.expires_at || new Date(createdAtTime + maxLifetime).toISOString(),
        };

        return NextResponse.json(safeReportData);
    } catch (error: any) {
        console.error("Error in parent reports API:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
