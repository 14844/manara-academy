import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";

/**
 * GET /api/instructor/students
 * Optional query param: ?studentId=<id>
 * Returns profile details (including phone, parent_phone, email) for students
 * who are enrolled in at least one course of the requesting instructor.
 */
export async function GET(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user || (user.role !== "instructor" && user.role !== "admin")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const targetStudentId = searchParams.get("studentId");

        // 1. Fetch instructor's course IDs (if admin, has access to all)
        let instructorCourseIds: string[] = [];
        if (user.role !== "admin") {
            const coursesSnap = await adminDb
                .collection("courses")
                .where("instructor_id", "==", user.uid)
                .get();
            instructorCourseIds = coursesSnap.docs.map((d) => d.id);

            if (instructorCourseIds.length === 0) {
                return NextResponse.json(targetStudentId ? { error: "Student not enrolled in your courses" } : { students: [] }, { status: targetStudentId ? 403 : 200 });
            }
        }

        // 2. If single student requested
        if (targetStudentId) {
            if (user.role !== "admin") {
                // Verify enrollment
                const enrollmentsSnap = await adminDb
                    .collection("enrollments")
                    .where("student_id", "==", targetStudentId)
                    .where("instructor_id", "==", user.uid)
                    .limit(1)
                    .get();

                if (enrollmentsSnap.empty) {
                    return NextResponse.json({ error: "الطالب غير مسجل في أي من كورساتك" }, { status: 403 });
                }
            }

            const [pubSnap, privSnap] = await Promise.all([
                adminDb.doc(`profiles/${targetStudentId}`).get(),
                adminDb.doc(`profiles_private/${targetStudentId}`).get(),
            ]);

            if (!pubSnap.exists) {
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }

            const pub = pubSnap.data() || {};
            const priv = privSnap.data() || {};

            return NextResponse.json({
                student: {
                    id: targetStudentId,
                    full_name: pub.full_name || "",
                    avatar_url: pub.avatar_url || null,
                    grade_level: pub.grade_level || null,
                    created_at: pub.created_at || null,
                    email: priv.email || pub.email || "",
                    phone: priv.phone || pub.phone || "",
                    parent_phone: priv.parent_phone || pub.parent_phone || "",
                    status: priv.status || pub.status || "active",
                    student_id: priv.student_id || pub.student_id || "N/A",
                },
            });
        }

        // 3. Batch request for all students enrolled with this instructor
        let enrolledStudentIds: string[] = [];
        if (user.role === "admin") {
            const allEnrollments = await adminDb.collection("enrollments").get();
            enrolledStudentIds = Array.from(new Set(allEnrollments.docs.map((d) => d.data().student_id).filter(Boolean)));
        } else {
            const enrollmentsSnap = await adminDb
                .collection("enrollments")
                .where("instructor_id", "==", user.uid)
                .get();
            enrolledStudentIds = Array.from(new Set(enrollmentsSnap.docs.map((d) => d.data().student_id).filter(Boolean)));
        }

        if (enrolledStudentIds.length === 0) {
            return NextResponse.json({ students: {} });
        }

        // Fetch profiles in chunks of 30
        const studentsMap: Record<string, any> = {};
        for (let i = 0; i < enrolledStudentIds.length; i += 30) {
            const chunk = enrolledStudentIds.slice(i, i + 30);
            const [pubDocs, privDocs] = await Promise.all([
                Promise.all(chunk.map((id) => adminDb.doc(`profiles/${id}`).get())),
                Promise.all(chunk.map((id) => adminDb.doc(`profiles_private/${id}`).get())),
            ]);

            chunk.forEach((id, idx) => {
                const pub = pubDocs[idx].exists ? pubDocs[idx].data() || {} : {};
                const priv = privDocs[idx].exists ? privDocs[idx].data() || {} : {};
                studentsMap[id] = {
                    id,
                    full_name: pub.full_name || "",
                    avatar_url: pub.avatar_url || null,
                    grade_level: pub.grade_level || null,
                    email: priv.email || pub.email || "",
                    phone: priv.phone || pub.phone || "",
                    parent_phone: priv.parent_phone || pub.parent_phone || "",
                    status: priv.status || pub.status || "active",
                    student_id: priv.student_id || pub.student_id || "N/A",
                };
            });
        }

        return NextResponse.json({ students: studentsMap });
    } catch (err: any) {
        console.error("Instructor students API error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
