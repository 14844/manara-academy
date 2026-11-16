import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { activityLogRole, getActiveServerAuth, logRouteFailure } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { PLANS, getEffectivePlan, isPlanId } from "@/lib/plans";

const ALLOWED_MONTHS = [1, 3, 6, 12];

/**
 * POST /api/instructor/plan/request  body { planId, months }
 * - Free plan ("starter") is applied immediately → { applied: true }
 * - Paid plans create a pending plan_requests doc for admin review → { requestId }
 */
export async function POST(request: Request) {
    try {
        const user = await getActiveServerAuth(request);
        if (!user || user.role !== "instructor") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { planId } = body || {};
        const months = Number(body?.months);

        if (!isPlanId(planId)) {
            return NextResponse.json({ error: "الباقة غير صالحة" }, { status: 400 });
        }

        const plan = PLANS[planId];
        const now = new Date().toISOString();
        const actorName = user.profile?.full_name || user.email || "محاضر";
        const privateRef = adminDb.collection("profiles_private").doc(user.uid);

        // Free plan: apply immediately (no admin review / payment needed)
        if (plan.monthlyPrice <= 0) {
            const privSnap = await privateRef.get();
            const previous = getEffectivePlan(privSnap.exists ? privSnap.data() : null);
            await privateRef.set({
                plan_id: planId,
                plan_expires_at: null,
                updated_at: now,
            }, { merge: true });

            await logServerActivity({
                action: "instructor_plan_changed",
                category: "financial",
                title: `تغيير باقة المدرس إلى (${plan.name})`,
                description: `قام المحاضر "${actorName}" بالتحويل إلى الباقة المجانية "${plan.name}"`,
                status: "success",
                user_id: user.uid,
                user_name: actorName,
                user_email: user.email || "",
                user_role: activityLogRole(user),
                metadata: { previous_plan_id: previous.planId, plan_id: planId },
            }).catch(() => {});

            return NextResponse.json({ applied: true });
        }

        if (!ALLOWED_MONTHS.includes(months)) {
            return NextResponse.json({ error: "مدة الاشتراك غير صالحة" }, { status: 400 });
        }

        const requestRef = adminDb.collection("plan_requests").doc();
        const amount = plan.monthlyPrice * months;

        await adminDb.runTransaction(async (t) => {
            const [existingSnap, privSnap] = await Promise.all([
                t.get(adminDb.collection("plan_requests").where("instructor_id", "==", user.uid)),
                t.get(privateRef),
            ]);
            if (existingSnap.docs.some((d) => d.data().status === "pending")) {
                throw new Error("PENDING_EXISTS");
            }
            const current = getEffectivePlan(privSnap.exists ? privSnap.data() : null);
            t.create(requestRef, {
                instructor_id: user.uid,
                instructor_name: actorName,
                instructor_email: user.email || privSnap.data()?.email || "",
                current_plan_id: current.planId,
                requested_plan_id: planId,
                months,
                amount,
                status: "pending",
                note: "",
                created_at: now,
                reviewed_by: null,
                reviewed_at: null,
            });
        });

        await logServerActivity({
            action: "instructor_plan_requested",
            category: "financial",
            title: `طلب اشتراك في باقة (${plan.name})`,
            description: `قام المحاضر "${actorName}" بطلب الاشتراك في باقة "${plan.name}" لمدة ${months} شهر بقيمة ${amount} ج.م`,
            status: "pending",
            user_id: user.uid,
            user_name: actorName,
            user_email: user.email || "",
            user_role: activityLogRole(user),
            amount,
            metadata: { request_id: requestRef.id, plan_id: planId, months, amount },
        }).catch(() => {});

        return NextResponse.json({ requestId: requestRef.id });
    } catch (err: any) {
        await logRouteFailure(request, {
            action: "instructor_plan_request_failed",
            category: "admin_action",
            title: "فشل طلب ترقية باقة",
            description: "تعذر تسجيل طلب باقة المدرس",
            error: err,
        });
        if (err?.message === "PENDING_EXISTS") {
            return NextResponse.json({ error: "لديك طلب باقة قيد المراجعة بالفعل" }, { status: 409 });
        }
        console.error("Instructor plan request error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
