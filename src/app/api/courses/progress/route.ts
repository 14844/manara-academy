import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limiter";

export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientIp = getClientIp(request);
        const rateCheck = await checkRateLimitAsync(`progress_${user.uid || clientIp}`, 60, 60);
        if (!rateCheck.success) {
            return NextResponse.json({ error: "Too many progress updates" }, { status: 429 });
        }

        const body = await request.json();
        const { courseId, lessonId } = body;

        if (!courseId || typeof courseId !== "string" || !lessonId || typeof lessonId !== "string") {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        // Fetch course document to verify lesson and get total lessons
        const courseRef = adminDb.collection("courses").doc(courseId);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const courseData = courseSnap.data() || {};
        const modules = courseData.modules || [];
        const allLessons: any[] = modules.flatMap((m: any) => m.lessons || []);
        const totalLessons = allLessons.length || 1;

        const lessonExists = allLessons.some((l: any) => l.id?.toString() === lessonId.toString());
        if (!lessonExists) {
            return NextResponse.json({ error: "Lesson does not belong to course" }, { status: 400 });
        }

        const enrollmentId = `${user.uid}_${courseId}`;
        const enrollmentRef = adminDb.collection("enrollments").doc(enrollmentId);

        let newProgress = 0;
        let newCompleted: string[] = [];

        await adminDb.runTransaction(async (t) => {
            const enrollmentSnap = await t.get(enrollmentRef);
            if (!enrollmentSnap.exists) {
                throw new Error("ENROLLMENT_NOT_FOUND");
            }

            const enrData = enrollmentSnap.data() || {};
            if (enrData.student_id !== user.uid) {
                throw new Error("FORBIDDEN");
            }

            const existingCompleted: string[] = enrData.completed_lessons || [];
            if (!existingCompleted.includes(lessonId)) {
                newCompleted = [...existingCompleted, lessonId];
            } else {
                newCompleted = existingCompleted;
            }

            newProgress = Math.min(100, Math.round((newCompleted.length / totalLessons) * 100));

            t.update(enrollmentRef, {
                completed_lessons: newCompleted,
                progress: newProgress,
                last_lesson_id: lessonId,
                last_accessed_lesson: lessonId,
                updated_at: new Date().toISOString(),
            });
        });

        return NextResponse.json({
            success: true,
            progress: newProgress,
            completed_lessons: newCompleted,
        });
    } catch (err: any) {
        if (err.message === "ENROLLMENT_NOT_FOUND" || err.message === "FORBIDDEN") {
            return NextResponse.json({ error: "غير مصرح لك بتحديث هذا الكورس" }, { status: 403 });
        }
        console.error("Progress update error:", err);
        return NextResponse.json({ error: "فشل تحديث التقدم الدراسي" }, { status: 500 });
    }
}
