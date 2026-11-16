import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { activityLogRole, logRouteFailure, requirePermission } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { PLANS, isPlanId } from "@/lib/plans";

function addMonths(base: Date, months: number): Date {
    const d = new Date(base.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
}

/**
 * POST /api/admin/plans/assign  (plans.manage)
 * body { instructorId, planId, months?, requestId?, chargeWallet? }
 * Sets the instructor's plan (optionally charging their wallet and approving a pending request).
 */
export async function POST(request: Request) {
    let logInstructorId = "";
    let logPlanId = "";
    let logPlanRequestId = "";
    try {
        const user = await requirePermission(request, "plans.manage");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { instructorId, planId, requestId } = body || {};
        logInstructorId = typeof instructorId === "string" ? instructorId.slice(0, 128) : "";
        logPlanId = typeof planId === "string" ? planId.slice(0, 64) : "";
        logPlanRequestId = typeof requestId === "string" ? requestId.slice(0, 128) : "";
        const chargeWallet = body?.chargeWallet === true;

        if (!instructorId || typeof instructorId !== "string" || instructorId.includes("/")) {
            return NextResponse.json({ error: "معرّف المدرس مطلوب" }, { status: 400 });
        }
        if (!isPlanId(planId)) {
            return NextResponse.json({ error: "الباقة غير صالحة" }, { status: 400 });
        }
        if (requestId !== undefined && requestId !== null && (typeof requestId !== "string" || !requestId || requestId.includes("/"))) {
            return NextResponse.json({ error: "معرّف الطلب غير صالح" }, { status: 400 });
        }

        const plan = PLANS[planId];
        const isFree = plan.monthlyPrice <= 0;
        const rawMonths = body?.months;
        const months = rawMonths === undefined || rawMonths === null ? 1 : Number(rawMonths);
        if (!isFree && (!Number.isInteger(months) || months < 1 || months > 36)) {
            return NextResponse.json({ error: "عدد الشهور غير صالح" }, { status: 400 });
        }

        const profileRef = adminDb.collection("profiles").doc(instructorId);
        const privateRef = adminDb.collection("profiles_private").doc(instructorId);
        const requestRef = requestId ? adminDb.collection("plan_requests").doc(requestId) : null;
        const txRef = adminDb.collection("transactions").doc();

        const actorName = user.profile?.full_name || user.email || "مسؤول المنصة";
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const chargeAmount = isFree ? 0 : plan.monthlyPrice * months;
        const willCharge = chargeWallet && chargeAmount > 0;

        let instructorName = "";
        let previousPlanId: string | null = null;
        let newExpiresAt: string | null = null;

        await adminDb.runTransaction(async (t) => {
            const [profileSnap, privSnap, reqSnap] = await Promise.all([
                t.get(profileRef),
                t.get(privateRef),
                requestRef ? t.get(requestRef) : Promise.resolve(null),
            ]);

            if (!profileSnap.exists) throw new Error("USER_NOT_FOUND");
            if (profileSnap.data()?.role !== "instructor") throw new Error("NOT_INSTRUCTOR");
            instructorName = profileSnap.data()?.full_name || "";

            if (requestRef) {
                if (!reqSnap || !reqSnap.exists) throw new Error("REQUEST_NOT_FOUND");
                const reqData = reqSnap.data() || {};
                if (reqData.instructor_id !== instructorId) throw new Error("REQUEST_MISMATCH");
                if (reqData.status !== "pending") throw new Error("REQUEST_NOT_PENDING");
                // Approving a request must grant exactly what was requested
                if (reqData.requested_plan_id !== planId) throw new Error("REQUEST_TERMS_MISMATCH");
                if (!isFree && Number(reqData.months) !== months) throw new Error("REQUEST_TERMS_MISMATCH");
            }

            const priv = privSnap.exists ? privSnap.data() || {} : {};
            previousPlanId = isPlanId(priv.plan_id) ? priv.plan_id : null;

            if (isFree) {
                newExpiresAt = null;
            } else {
                let base = nowDate;
                const currentExpiry = typeof priv.plan_expires_at === "string" ? new Date(priv.plan_expires_at) : null;
                if (priv.plan_id === planId && currentExpiry && Number.isFinite(currentExpiry.getTime()) && currentExpiry > nowDate) {
                    base = currentExpiry;
                }
                newExpiresAt = addMonths(base, months).toISOString();
            }

            const update: Record<string, any> = {
                plan_id: planId,
                plan_expires_at: newExpiresAt,
                updated_at: now,
            };

            if (willCharge) {
                const balance = Number(priv.wallet_balance ?? 0);
                if (balance < chargeAmount) throw new Error("INSUFFICIENT_BALANCE");
                update.wallet_balance = balance - chargeAmount;

                t.create(txRef, {
                    type: "plan_subscription",
                    instructor_id: instructorId,
                    instructor_name: instructorName,
                    amount: chargeAmount,
                    plan_id: planId,
                    months,
                    payment_method: "wallet",
                    request_id: requestId || null,
                    admin_id: user.uid,
                    admin_name: actorName,
                    status: "completed",
                    details: `اشتراك باقة "${plan.name}" لمدة ${months} شهر (خصم من المحفظة)`,
                    created_at: now,
                });
            }

            t.set(privateRef, update, { merge: true });

            if (requestRef) {
                t.update(requestRef, {
                    status: "approved",
                    reviewed_by: user.uid,
                    reviewed_at: now,
                });
            }
        });

        await logServerActivity({
            action: "admin_plan_assigned",
            category: willCharge ? "financial" : "admin_action",
            title: `تعيين باقة (${plan.name}) لمدرس`,
            description: `قام "${actorName}" بتعيين باقة "${plan.name}" للمدرس "${instructorName || instructorId}"${isFree ? "" : ` لمدة ${months} شهر`}${willCharge ? ` مع خصم ${chargeAmount} ج.م من محفظته` : ""}`,
            status: "success",
            user_id: user.uid,
            user_name: actorName,
            user_email: user.email || "",
            user_role: activityLogRole(user),
            target_user_id: instructorId,
            target_user_name: instructorName,
            ...(willCharge ? { amount: -chargeAmount } : {}),
            metadata: {
                target_user_id: instructorId,
                previous_plan_id: previousPlanId,
                plan_id: planId,
                months: isFree ? null : months,
                plan_expires_at: newExpiresAt,
                charged_wallet: willCharge,
                charge_amount: willCharge ? chargeAmount : 0,
                request_id: requestId || null,
                transaction_id: willCharge ? txRef.id : null,
            },
        }).catch(() => {});

        return NextResponse.json({ success: true, planId, expiresAt: newExpiresAt });
    } catch (err: any) {
        await logRouteFailure(request, {
            action: "admin_plan_assign_failed",
            category: "admin_action",
            title: "فشل تعيين باقة لمدرس",
            description: `تعذر تعيين الباقة ${logPlanId || "(غير محددة)"} للمدرس ${logInstructorId || "(غير محدد)"}`,
            error: err,
            target_user_id: logInstructorId || undefined,
            metadata: { plan_id: logPlanId, request_id: logPlanRequestId },
        });
        switch (err?.message) {
            case "USER_NOT_FOUND":
                return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
            case "NOT_INSTRUCTOR":
                return NextResponse.json({ error: "الباقات متاحة لحسابات المدرسين فقط" }, { status: 400 });
            case "REQUEST_NOT_FOUND":
                return NextResponse.json({ error: "طلب الباقة غير موجود" }, { status: 404 });
            case "REQUEST_MISMATCH":
                return NextResponse.json({ error: "طلب الباقة لا يخص هذا المدرس" }, { status: 400 });
            case "REQUEST_TERMS_MISMATCH":
                return NextResponse.json({ error: "الباقة أو عدد الشهور لا يطابق طلب المدرس" }, { status: 400 });
            case "REQUEST_NOT_PENDING":
                return NextResponse.json({ error: "تمت مراجعة هذا الطلب بالفعل" }, { status: 409 });
            case "INSUFFICIENT_BALANCE":
                return NextResponse.json({ error: "الرصيد غير كافٍ" }, { status: 400 });
        }
        console.error("Admin plan assign error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
