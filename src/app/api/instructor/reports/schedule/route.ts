import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveServerAuth, logAccessDenied } from "@/lib/server-auth";
import { getInstructorPlan } from "@/lib/plan-access";
import { cheapestPlanWith } from "@/lib/plans";

export const dynamic = "force-dynamic";

const VALID_DAYS = new Set(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * GET /api/instructor/reports/schedule
 * The signed-in instructor's automatic parent-report schedules + whether their plan unlocks the
 * feature (`autoParentReports`). Schedules are always returned (never deleted on downgrade) so they
 * come back as-is after an upgrade; they are simply not executed while the plan lacks the feature.
 */
export async function GET(request: Request) {
    try {
        const user = await getActiveServerAuth(request);
        if (!user || user.role !== "instructor") {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }
        const [eff, schedSnap] = await Promise.all([
            getInstructorPlan(user.uid),
            adminDb.collection("report_schedules").where("instructor_id", "==", user.uid).get(),
        ]);
        return NextResponse.json({
            planId: eff.planId,
            autoParentReports: eff.plan.access.autoParentReports === true,
            requiredPlanId: cheapestPlanWith("autoParentReports").id,
            schedules: schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
    } catch (err) {
        console.error("Report schedule GET error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}

/**
 * POST /api/instructor/reports/schedule  { courseId, day, time, enabled }
 * Creates/updates the weekly schedule of one of the instructor's courses. Requires a plan with
 * `autoParentReports`.
 */
export async function POST(request: Request) {
    try {
        const user = await getActiveServerAuth(request);
        if (!user || user.role !== "instructor") {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }

        const eff = await getInstructorPlan(user.uid);
        if (!eff.plan.access.autoParentReports) {
            logAccessDenied(request, user, "reports.auto_schedule", "باقة المدرس لا تتضمن التقارير التلقائية");
            return NextResponse.json(
                { error: `الجدولة التلقائية متاحة في باقة ${cheapestPlanWith("autoParentReports").name}`, code: "plan_required" },
                { status: 403 },
            );
        }

        const body = await request.json().catch(() => ({}));
        const { courseId, day, time, enabled } = body || {};
        if (typeof courseId !== "string" || !/^[\w-]+$/.test(courseId)) {
            return NextResponse.json({ error: "معرّف الكورس غير صالح" }, { status: 400 });
        }
        if (typeof day !== "string" || !VALID_DAYS.has(day)) {
            return NextResponse.json({ error: "يوم الإرسال غير صالح" }, { status: 400 });
        }
        if (typeof time !== "string" || !TIME_RE.test(time)) {
            return NextResponse.json({ error: "وقت الإرسال غير صالح" }, { status: 400 });
        }
        if (typeof enabled !== "boolean") {
            return NextResponse.json({ error: "حالة التفعيل غير صالحة" }, { status: 400 });
        }

        const courseSnap = await adminDb.collection("courses").doc(courseId).get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        if (courseSnap.data()?.instructor_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بإدارة هذا الكورس" }, { status: 403 });
        }

        // Reuse the existing doc for this course if there is one (ids were `${courseId}_schedule`).
        const existing = await adminDb
            .collection("report_schedules")
            .where("instructor_id", "==", user.uid)
            .where("course_id", "==", courseId)
            .limit(1)
            .get()
            .catch(() => null);
        const scheduleId = existing && !existing.empty ? existing.docs[0].id : `${courseId}_schedule`;

        const payload = {
            id: scheduleId,
            course_id: courseId,
            instructor_id: user.uid,
            day_of_week: day,
            time,
            enabled,
            updated_at: new Date().toISOString(),
        };
        await adminDb.collection("report_schedules").doc(scheduleId).set(payload, { merge: true });

        return NextResponse.json({ success: true, schedule: payload });
    } catch (err) {
        console.error("Report schedule POST error:", err);
        return NextResponse.json({ error: "فشل في حفظ إعدادات الجدولة" }, { status: 500 });
    }
}
