import { NextResponse } from "next/server";
import { getActiveServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { logServerActivity } from "@/lib/server-activity-logger";

/**
 * POST /api/instructor/students/kick  { studentId, courseId? }
 * Suspends (never deletes) the student's enrollment(s) in the caller's course(s).
 * - courseId given: only that course (must belong to the instructor; admins: any course).
 * - courseId omitted: every course of the instructor the student is enrolled in.
 * Counters (students_count / total_sales) are NOT decremented, so kicking can't unlock
 * price edits or course deletion. Admin refunds go through /api/admin/payments/refund.
 */
export async function POST(request: Request) {
    const user = await getActiveServerAuth(request);
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية" }, { status: 403 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { studentId, courseId } = body || {};

        if (!studentId || typeof studentId !== "string" || !/^[\w-]+$/.test(studentId)) {
            return NextResponse.json({ error: "معرّف الطالب غير صالح" }, { status: 400 });
        }
        if (courseId !== undefined && courseId !== null && (typeof courseId !== "string" || !/^[\w-]+$/.test(courseId))) {
            return NextResponse.json({ error: "معرّف الكورس غير صالح" }, { status: 400 });
        }

        let targetCourseIds: string[] = [];
        if (courseId) {
            const courseDoc = await adminDb.collection("courses").doc(courseId).get();
            if (!courseDoc.exists) {
                return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
            }
            if (user.role !== "admin" && courseDoc.data()?.instructor_id !== user.uid) {
                return NextResponse.json({ error: "ليس لديك صلاحية على هذا الكورس" }, { status: 403 });
            }
            targetCourseIds = [courseId];
        } else {
            if (user.role === "admin") {
                return NextResponse.json({ error: "معرّف الكورس مطلوب" }, { status: 400 });
            }
            const coursesSnap = await adminDb.collection("courses").where("instructor_id", "==", user.uid).get();
            targetCourseIds = coursesSnap.docs.map(d => d.id);
        }

        if (targetCourseIds.length === 0) {
            return NextResponse.json({ error: "لا توجد كورسات مسجلة لهذا المحاضر" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const batch = adminDb.batch();
        const suspendedCourses: string[] = [];

        const refs = targetCourseIds.map(cid => adminDb.collection("enrollments").doc(`${studentId}_${cid}`));
        const snaps = refs.length ? await adminDb.getAll(...refs) : [];
        snaps.forEach((snap, i) => {
            if (!snap.exists) return;
            if (snap.data()?.status === "suspended") return;
            batch.update(snap.ref, {
                status: "suspended",
                suspended_at: now,
                suspended_by: user.uid,
                updated_at: now,
            });
            suspendedCourses.push(targetCourseIds[i]);
        });

        if (suspendedCourses.length === 0) {
            return NextResponse.json({ error: "لم يتم العثور على اشتراكات نشطة لهذا الطالب في كورساتك" }, { status: 404 });
        }

        await batch.commit();

        await logServerActivity({
            action: "student_suspended_by_instructor",
            category: "course",
            title: "إيقاف طالب من الكورس",
            description: `قام ${user.role === "admin" ? "المسؤول" : "المحاضر"} "${user.profile?.full_name || user.email}" بإيقاف اشتراك الطالب "${studentId}" في ${suspendedCourses.length} كورس`,
            status: "success",
            user_id: user.uid,
            user_name: user.profile?.full_name || user.email || "محاضر",
            user_email: user.email,
            user_role: user.role,
            target_user_id: studentId,
            metadata: {
                student_id: studentId,
                course_ids: suspendedCourses,
                action_type: "suspend",
            },
        });

        return NextResponse.json({ success: true, action: "suspended", count: suspendedCourses.length });
    } catch (err: any) {
        console.error("Kick student error:", err);
        return NextResponse.json({ error: "حدث خطأ أثناء استبعاد الطالب" }, { status: 500 });
    }
}
