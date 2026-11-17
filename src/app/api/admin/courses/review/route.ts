import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { logActor, logRouteFailure, requirePermission } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getRoleLabel } from "@/lib/permissions";
import { getEffectivePlan } from "@/lib/plans";
import { featuredUntilFor } from "@/lib/featured-listing-server";

class ReviewError extends Error {
    constructor(message: string, public httpStatus: number) {
        super(message);
    }
}

/**
 * POST /api/admin/courses/review
 * Body: { courseId, decision: "approved" | "rejected", reason? }
 * Approves or rejects a pending course (courses.review). Fails with 409 if the course is not pending.
 */
export async function POST(request: Request) {
    const user = await requirePermission(request, "courses.review");
    if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    const courseId = body?.courseId;
    const decision = body?.decision;
    const rawReason = body?.reason;

    if (typeof courseId !== "string" || !courseId || courseId.includes("/") || courseId.length > 200) {
        return NextResponse.json({ error: "معرف الكورس غير صالح" }, { status: 400 });
    }
    if (decision !== "approved" && decision !== "rejected") {
        return NextResponse.json({ error: "قرار غير صالح" }, { status: 400 });
    }
    if (rawReason !== undefined && rawReason !== null && typeof rawReason !== "string") {
        return NextResponse.json({ error: "سبب غير صالح" }, { status: 400 });
    }
    const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 1000) : "";

    const courseRef = adminDb.collection("courses").doc(courseId);
    const now = new Date().toISOString();
    let course: Record<string, any> = {};

    try {
        await adminDb.runTransaction(async (t) => {
            const snap = await t.get(courseRef);
            if (!snap.exists) {
                throw new ReviewError("الكورس غير موجود", 404);
            }
            course = snap.data() || {};
            if (course.status !== "pending") {
                throw new ReviewError("تمت مراجعة هذا الكورس بالفعل أو أنه ليس قيد المراجعة", 409);
            }
            // On approval, denormalize the instructor's featured listing (from their current effective plan)
            let featuredUntil: string | null = null;
            const instructorId = course.instructor_id;
            if (decision === "approved" && typeof instructorId === "string" && instructorId && !instructorId.includes("/")) {
                const privSnap = await t.get(adminDb.collection("profiles_private").doc(instructorId));
                featuredUntil = featuredUntilFor(getEffectivePlan(privSnap.exists ? privSnap.data() : null));
            }
            t.update(courseRef, {
                ...(decision === "approved" ? { featured_until: featuredUntil } : {}),
                status: decision,
                updated_at: now,
                reviewed_by: user.uid,
                reviewed_at: now,
                rejection_reason: decision === "rejected" ? (reason || null) : null,
            });
        });
    } catch (err) {
        if (err instanceof ReviewError) {
            return NextResponse.json({ error: err.message }, { status: err.httpStatus });
        }
        console.error("Course review error:", err);
        await logRouteFailure(request, {
            action: decision === "approved" ? "course_approve_failed" : "course_reject_failed",
            title: decision === "approved" ? "فشل اعتماد كورس" : "فشل رفض كورس",
            description: `تعذر تنفيذ مراجعة الكورس (${courseId})`,
            category: "admin_action",
            error: err,
            user,
            metadata: { course_id: courseId, decision },
        });
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }

    const roleLabel = getRoleLabel(user.role);
    const courseTitle = course.title || courseId;
    const instructorName = course.instructor_name || "محاضر";
    const approved = decision === "approved";

    await logServerActivity(
        {
            action: approved ? "course_approved" : "course_rejected",
            category: "admin_action",
            title: approved ? "اعتماد ونشر كورس جديد" : "رفض كورس",
            description: approved
                ? `وافق ${roleLabel} على نشر كورس "${courseTitle}" للمحاضر "${instructorName}"`
                : `رفض ${roleLabel} نشر كورس "${courseTitle}" للمحاضر "${instructorName}"${reason ? ` — السبب: ${reason}` : ""}`,
            status: approved ? "success" : "failed",
            ...logActor(user),
            target_user_id: course.instructor_id,
            target_user_name: course.instructor_name,
            metadata: {
                course_id: courseId,
                course_title: course.title,
                price: course.price,
                decision,
                rejection_reason: approved ? undefined : reason || undefined,
            },
        },
        request,
        user,
    ).catch(() => {});

    return NextResponse.json({ success: true, status: decision });
}
