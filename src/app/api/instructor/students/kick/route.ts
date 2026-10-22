import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية" }, { status: 403 });
    }
    if (user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { studentId, courseId } = body;

        if (!studentId || typeof studentId !== "string") {
            return NextResponse.json({ error: "معرّف الطالب غير صالح" }, { status: 400 });
        }

        // Determine courses that belong to this instructor
        let allowedCourseIds: string[] = [];
        if (user.role === "instructor") {
            const coursesSnap = await adminDb.collection("courses")
                .where("instructor_id", "==", user.uid)
                .get();
            allowedCourseIds = coursesSnap.docs.map(d => d.id);

            if (allowedCourseIds.length === 0) {
                return NextResponse.json({ error: "لا توجد كورسات مسجلة لهذا المحاضر" }, { status: 400 });
            }
        }

        // Query enrollments for this student
        const enrollmentsSnap = await adminDb.collection("enrollments")
            .where("student_id", "==", studentId)
            .get();

        if (enrollmentsSnap.empty) {
            return NextResponse.json({ error: "لم يتم العثور على اشتراكات لهذا الطالب" }, { status: 404 });
        }

        const batch = adminDb.batch();
        let deletedCount = 0;

        for (const docSnap of enrollmentsSnap.docs) {
            const eData = docSnap.data();
            const enrollmentCourseId = eData.course_id;

            // Check authorization: admin can kick from any course; instructor only from their own
            const canKick = user.role === "admin" || allowedCourseIds.includes(enrollmentCourseId);
            const matchesCourse = !courseId || courseId === enrollmentCourseId;

            if (canKick && matchesCourse) {
                batch.delete(docSnap.ref);
                deletedCount++;

                // Decrement students_count on course doc
                if (enrollmentCourseId) {
                    const cRef = adminDb.collection("courses").doc(enrollmentCourseId);
                    batch.update(cRef, {
                        students_count: FieldValue.increment(-1),
                        updated_at: new Date().toISOString(),
                    });
                }
            }
        }

        if (deletedCount === 0) {
            return NextResponse.json({ error: "لم يتم العثور على اشتراكات مصرح لك بحذفها" }, { status: 403 });
        }

        await batch.commit();

        // Log server activity
        await logServerActivity({
            action: "student_unregistered_by_instructor",
            category: "course",
            title: "استبعاد طالب من الكورس",
            description: `قام ${user.role === "admin" ? "المسؤول" : "المحاضر"} "${user.profile?.full_name || user.email}" باستبعاد الطالب "${studentId}" من ${deletedCount} كورس`,
            status: "success",
            user_id: user.uid,
            user_name: user.profile?.full_name || user.email || "محاضر",
            user_email: user.email,
            user_role: user.role,
            target_user_id: studentId,
            metadata: {
                student_id: studentId,
                course_id: courseId || "all_instructor_courses",
                deleted_enrollments_count: deletedCount,
            },
        });

        return NextResponse.json({ success: true, count: deletedCount });
    } catch (err: any) {
        console.error("Kick student error:", err);
        return NextResponse.json({ error: "حدث خطأ أثناء استبعاد الطالب" }, { status: 500 });
    }
}
