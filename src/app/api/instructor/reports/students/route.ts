import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";

/**
 * GET /api/instructor/reports/students?courseId=<courseId>&includePending=true
 * Secure server-side endpoint for instructors to fetch enrolled students and their report data
 * without hitting Firestore client security rules or missing index errors.
 */
export async function GET(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user || (user.role !== "instructor" && user.role !== "admin")) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const courseId = searchParams.get("courseId");
        const includePending = searchParams.get("includePending") === "true";

        if (!courseId) {
            return NextResponse.json({ error: "معرّف الكورس مطلوب" }, { status: 400 });
        }

        // 1. Verify course ownership
        const courseRef = adminDb.collection("courses").doc(courseId);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const courseData = courseSnap.data() || {};
        if (user.role !== "admin" && courseData.instructor_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بإدارة هذا الكورس" }, { status: 403 });
        }

        const totalLessons = courseData.modules?.reduce(
            (acc: number, mod: any) => acc + (mod.lessons?.length || 0),
            0
        ) || 0;

        // 2. Fetch all enrollments for this course
        const enrollmentsSnap = await adminDb
            .collection("enrollments")
            .where("course_id", "==", courseId)
            .get();

        const enrollments = enrollmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (enrollments.length === 0) {
            return NextResponse.json({
                course: {
                    id: courseId,
                    title: courseData.title || "كورس",
                    totalLessons,
                },
                students: [],
                pendingReports: [],
            });
        }

        // 3. Batch fetch profiles and submissions for all students
        const studentIds = Array.from(new Set(enrollments.map((e: any) => e.student_id).filter(Boolean)));

        // Fetch profiles & profiles_private in parallel chunks of 30
        const profilesMap: Record<string, any> = {};
        for (let i = 0; i < studentIds.length; i += 30) {
            const chunk = studentIds.slice(i, i + 30);
            const [pubDocs, privDocs] = await Promise.all([
                Promise.all(chunk.map((id) => adminDb.collection("profiles").doc(id).get())),
                Promise.all(chunk.map((id) => adminDb.collection("profiles_private").doc(id).get())),
            ]);

            chunk.forEach((id, idx) => {
                const pub = pubDocs[idx].exists ? pubDocs[idx].data() || {} : {};
                const priv = privDocs[idx].exists ? privDocs[idx].data() || {} : {};
                profilesMap[id] = {
                    ...pub,
                    ...priv,
                    id,
                };
            });
        }

        // Fetch submissions for this course
        const submissionsSnap = await adminDb
            .collection("submissions")
            .where("course_id", "==", courseId)
            .get();

        const submissionsByStudent: Record<string, any[]> = {};
        submissionsSnap.docs.forEach((doc) => {
            const data = doc.data();
            const sid = data.student_id;
            if (sid) {
                if (!submissionsByStudent[sid]) submissionsByStudent[sid] = [];
                submissionsByStudent[sid].push({ id: doc.id, ...data });
            }
        });

        // Assemble student list
        const students = enrollments.map((enr: any) => {
            const profile = profilesMap[enr.student_id] || {};
            const subs = submissionsByStudent[enr.student_id] || [];

            return {
                id: enr.student_id,
                name: profile.full_name || enr.student_name || "طالب بدون اسم",
                email: profile.email || "غير متوفر",
                phone: profile.phone || "غير متوفر",
                parentPhone: profile.parent_phone || "",
                studentCode: profile.student_id || enr.student_unique_id || "N/A",
                avatar: profile.avatar_url || null,
                progress: enr.progress || 0,
                completedLessons: enr.completed_lessons?.length || 0,
                totalLessons,
                lastAccessed: enr.last_accessed || null,
                submissions: subs,
                enrollmentId: enr.id,
            };
        });

        // 4. Pending scheduled reports calculation if requested
        let pendingReports: any[] = [];
        if (includePending) {
            const daysMap: Record<number, string> = {
                0: "sunday",
                1: "monday",
                2: "tuesday",
                3: "wednesday",
                4: "thursday",
                5: "friday",
                6: "saturday",
            };
            const todayDay = daysMap[new Date().getDay()];
            const currentYear = new Date().getFullYear();
            const currentJan1 = new Date(currentYear, 0, 1);
            const numberOfDays = Math.floor((new Date().getTime() - currentJan1.getTime()) / (24 * 60 * 60 * 1000));
            const currentWeekString = `${currentYear}-W${Math.ceil((numberOfDays + currentJan1.getDay() + 1) / 7)}`;

            // Fetch schedules for this instructor
            const schedQuery = user.role === "admin"
                ? adminDb.collection("report_schedules")
                : adminDb.collection("report_schedules").where("instructor_id", "==", user.uid);
            
            const schedSnap = await schedQuery.get();
            const activeSchedules = schedSnap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((s: any) => s.enabled && s.day_of_week === todayDay);

            if (activeSchedules.length > 0) {
                // Fetch reports sent this week
                const sentReportsSnap = await adminDb
                    .collection("parent_reports")
                    .where("instructor_id", "==", user.uid)
                    .get();

                const sentThisWeekKeys = new Set(
                    sentReportsSnap.docs
                        .map((d) => d.data())
                        .filter((r) => {
                            const cDate = new Date(r.created_at);
                            const jan1 = new Date(cDate.getFullYear(), 0, 1);
                            const days = Math.floor((cDate.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
                            const weekStr = `${cDate.getFullYear()}-W${Math.ceil((days + jan1.getDay() + 1) / 7)}`;
                            return weekStr === currentWeekString;
                        })
                        .map((r) => `${r.student_id}_${r.course_id}`)
                );

                for (const sched of activeSchedules as any[]) {
                    // Match students enrolled in this sched.course_id
                    const schedCourseSnap = await adminDb.collection("courses").doc(sched.course_id).get();
                    const sCourseData = schedCourseSnap.data() || {};
                    const sTotalLessons = sCourseData.modules?.reduce(
                        (acc: number, mod: any) => acc + (mod.lessons?.length || 0),
                        0
                    ) || 0;

                    const schedEnrollmentsSnap = await adminDb
                        .collection("enrollments")
                        .where("course_id", "==", sched.course_id)
                        .get();

                    for (const enrDoc of schedEnrollmentsSnap.docs) {
                        const enr = enrDoc.data();
                        const key = `${enr.student_id}_${sched.course_id}`;
                        if (sentThisWeekKeys.has(key)) continue;

                        const prof = profilesMap[enr.student_id] || (
                            await adminDb.collection("profiles_private").doc(enr.student_id).get().then(s => s.data() || {})
                        );

                        const parentPhone = prof.parent_phone;
                        if (!parentPhone) continue;

                        const subs = submissionsByStudent[enr.student_id] || [];

                        pendingReports.push({
                            studentId: enr.student_id,
                            studentName: enr.student_name || prof.full_name || "طالب",
                            studentAvatar: prof.avatar_url || null,
                            parentPhone,
                            courseId: sched.course_id,
                            courseTitle: sCourseData.title || "كورس",
                            progress: enr.progress || 0,
                            completedLessons: enr.completed_lessons?.length || 0,
                            totalLessons: sTotalLessons,
                            lastAccessed: enr.last_accessed || null,
                            submissions: subs,
                            scheduleId: sched.id,
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            course: {
                id: courseId,
                title: courseData.title || "كورس",
                totalLessons,
            },
            students,
            pendingReports,
        });
    } catch (err: any) {
        console.error("Reports students API error:", err);
        return NextResponse.json({ error: "حدث خطأ أثناء تحميل بيانات الطلاب" }, { status: 500 });
    }
}
