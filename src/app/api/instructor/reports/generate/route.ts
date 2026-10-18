import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

/**
 * POST /api/instructor/reports/generate
 * Secure server-side report generation for parents.
 * Validates instructor course ownership, student enrollment, computes accurate stats,
 * and saves parent_reports/{reportToken} with a 64-char crypto token.
 */
export async function POST(request: Request) {
    try {
        let user = await getServerAuth(request);

        const body = await request.json().catch(() => ({}));
        const { studentId, courseId, manualNote, idToken } = body;

        // Fallback to idToken if session cookie is absent or expired
        if (!user && idToken && typeof idToken === "string") {
            try {
                const decoded = await adminAuth.verifyIdToken(idToken);
                const [profileDoc, privateDoc] = await Promise.all([
                    adminDb.collection("profiles").doc(decoded.uid).get(),
                    adminDb.collection("profiles_private").doc(decoded.uid).get(),
                ]);
                const profileData = profileDoc.data() || {};
                const privateData = privateDoc.data() || {};
                user = {
                    uid: decoded.uid,
                    email: decoded.email || privateData.email || "",
                    role: (profileData.role as any) || "instructor",
                    status: privateData.status || profileData.status || "active",
                    profile: { ...profileData, ...privateData },
                };
            } catch (tokenErr) {
                console.error("Token verification error in report generate:", tokenErr);
            }
        }

        if (!user || (user.role !== "instructor" && user.role !== "admin")) {
            return NextResponse.json({ error: "غير مصرح لك بتوليد تقارير الطلاب" }, { status: 403 });
        }
        if (user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "حسابك موقوف مؤقتاً" }, { status: 403 });
        }

        if (!studentId || typeof studentId !== "string") {
            return NextResponse.json({ error: "معرّف الطالب مطلوب" }, { status: 400 });
        }
        if (!courseId || typeof courseId !== "string") {
            return NextResponse.json({ error: "معرّف الكورس مطلوب" }, { status: 400 });
        }

        // 1. Verify course ownership
        const courseSnap = await adminDb.collection("courses").doc(courseId).get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const courseData = courseSnap.data() || {};
        if (user.role !== "admin" && courseData.instructor_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بإدارة هذا الكورس" }, { status: 403 });
        }

        // 2. Verify student enrollment
        const enrollmentDocId = `${studentId}_${courseId}`;
        let enrollmentSnap = await adminDb.collection("enrollments").doc(enrollmentDocId).get();
        if (!enrollmentSnap.exists) {
            const qSnap = await adminDb.collection("enrollments")
                .where("student_id", "==", studentId)
                .where("course_id", "==", courseId)
                .limit(1)
                .get();
            if (!qSnap.empty) {
                enrollmentSnap = qSnap.docs[0];
            }
        }

        if (!enrollmentSnap.exists) {
            return NextResponse.json({ error: "هذا الطالب غير مسجل في الكورس المحدد" }, { status: 400 });
        }
        const enrollmentData = enrollmentSnap.data() || {};

        // 3. Fetch profiles
        const [studentDoc, instructorDoc] = await Promise.all([
            adminDb.collection("profiles").doc(studentId).get(),
            adminDb.collection("profiles").doc(user.uid).get(),
        ]);
        const studentProfile = studentDoc.data() || {};
        const instructorProfile = instructorDoc.data() || {};

        // 4. Fetch submissions and compute exam stats
        const [studentSubsSnap, allCourseSubsSnap] = await Promise.all([
            adminDb.collection("submissions")
                .where("course_id", "==", courseId)
                .where("student_id", "==", studentId)
                .get(),
            adminDb.collection("submissions")
                .where("course_id", "==", courseId)
                .get(),
        ]);

        const maxScoreByLesson: Record<string, number> = {};
        allCourseSubsSnap.docs.forEach((d) => {
            const data = d.data();
            const lid = String(data.lesson_id || "");
            const s = Number(data.score) || 0;
            if (!maxScoreByLesson[lid] || s > maxScoreByLesson[lid]) {
                maxScoreByLesson[lid] = s;
            }
        });

        const modules = courseData.modules || [];
        const lessonTitleMap: Record<string, string> = {};
        let totalLessons = 0;
        modules.forEach((m: any) => {
            (m.lessons || []).forEach((l: any) => {
                totalLessons++;
                if (l.id) lessonTitleMap[String(l.id)] = l.title || "درس";
            });
        });

        const examsList = studentSubsSnap.docs.map((d) => {
            const sub = d.data();
            const lid = String(sub.lesson_id || "");
            const score = Number(sub.score) || 0;
            const highest = maxScoreByLesson[lid] || score;
            let submittedAtIso = new Date().toISOString();
            if (sub.submitted_at?.toDate) {
                submittedAtIso = sub.submitted_at.toDate().toISOString();
            } else if (sub.submitted_at?.seconds) {
                submittedAtIso = new Date(sub.submitted_at.seconds * 1000).toISOString();
            } else if (typeof sub.submitted_at === "string") {
                submittedAtIso = sub.submitted_at;
            }

            return {
                id: lid,
                title: lessonTitleMap[lid] || "اختبار تقييمي",
                score,
                highest_score: highest > 0 ? highest : score,
                submitted_at: submittedAtIso,
            };
        });

        const avgScore = examsList.length > 0
            ? Math.round(examsList.reduce((acc, curr) => acc + curr.score, 0) / examsList.length)
            : 0;

        const completedCount = Array.isArray(enrollmentData.completed_lessons)
            ? enrollmentData.completed_lessons.length
            : 0;

        // 5. Expiry (30 days) and 64-char crypto token
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);

        const reportToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

        const reportPayload = {
            student_id: studentId,
            student_name: studentProfile.full_name || enrollmentData.student_name || "طالب المنارة",
            student_avatar: studentProfile.avatar_url || null,
            instructor_id: user.uid,
            instructor_name: instructorProfile.full_name || user.email || "معلم المنارة",
            instructor_avatar: instructorProfile.avatar_url || null,
            course_id: courseId,
            course_title: courseData.title || "كورس",
            created_at: new Date().toISOString(),
            expires_at: expiry.toISOString(),
            manual_note: typeof manualNote === "string" && manualNote.trim() ? manualNote.trim() : "تقرير أداء ومتابعة الطالب",
            stats: {
                attendance_rate: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
                completed_lessons_count: completedCount,
                total_lessons_count: totalLessons,
                last_accessed: enrollmentData.last_accessed || null,
                progress: enrollmentData.progress || 0,
                average_score: avgScore,
            },
            exams: examsList,
        };

        await adminDb.collection("parent_reports").doc(reportToken).set(reportPayload);

        // 6. Log server activity
        await logServerActivity({
            action: "parent_report_generated",
            category: "course",
            title: `توليد تقرير ولي أمر: ${reportPayload.student_name}`,
            description: `قام المعلم (${reportPayload.instructor_name}) بتوليد تقرير متابعة للطالب (${reportPayload.student_name}) في كورس (${reportPayload.course_title})`,
            status: "success",
            user_id: user.uid,
            user_name: reportPayload.instructor_name,
            user_email: user.email || "",
            user_role: "instructor",
            metadata: {
                report_token: reportToken,
                student_id: studentId,
                course_id: courseId,
            },
        });

        return NextResponse.json({
            success: true,
            reportToken,
            reportUrl: `/report/${reportToken}`,
            report: { id: reportToken, ...reportPayload },
        });
    } catch (error: any) {
        console.error("Generate report API error:", error);
        return NextResponse.json({ error: error.message || "فشل توليد التقرير" }, { status: 500 });
    }
}
