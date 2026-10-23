import { NextResponse } from "next/server";
import { getActiveServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const user = await getActiveServerAuth(request);
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية" }, { status: 403 });
    }
    if (user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const rawAmount = body.net_amount ?? body.amount;
        const netAmount = Number(rawAmount);

        if (!Number.isFinite(netAmount) || netAmount <= 0) {
            return NextResponse.json({ error: "المبلغ المطلوب سحبه غير صالح" }, { status: 400 });
        }

        // Calculate 5% platform commission strictly on server
        const grossAmount = Math.round((netAmount / 0.95) * 100) / 100;
        const commission = Math.round((grossAmount - netAmount) * 100) / 100;

        const profileRef = adminDb.collection("profiles").doc(user.uid);
        const profilePrivateRef = adminDb.collection("profiles_private").doc(user.uid);
        const withdrawalRef = adminDb.collection("withdrawal_requests").doc();

        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        await adminDb.runTransaction(async (t) => {
            // All reads inside the transaction (serializable): pending + weekly checks can't be raced
            const [pSnap, privSnap, reqSnap] = await Promise.all([
                t.get(profileRef),
                t.get(profilePrivateRef),
                t.get(adminDb.collection("withdrawal_requests").where("instructor_id", "==", user.uid)),
            ]);
            if (!pSnap.exists) {
                throw new Error("PROFILE_NOT_FOUND");
            }

            const reqs = reqSnap.docs.map(d => d.data());
            if (reqs.some(r => r.status === "pending")) {
                throw new Error("PENDING_EXISTS");
            }
            const times = reqs
                .map(r => new Date(r.created_at || r.requested_at).getTime())
                .filter(n => Number.isFinite(n));
            const lastAt = privSnap.data()?.last_withdrawal_request_at;
            if (lastAt) {
                const n = new Date(lastAt).getTime();
                if (Number.isFinite(n)) times.push(n);
            }
            const lastReqTime = times.length ? Math.max(...times) : 0;
            const diffMs = Date.now() - lastReqTime;
            if (lastReqTime && diffMs < sevenDaysMs) {
                throw new Error(`WEEKLY_LIMIT:${lastReqTime}`);
            }

            const currentBalance = Number(privSnap.data()?.wallet_balance ?? 0);
            
            if (currentBalance < 0) {
                throw new Error(`NEGATIVE_BALANCE:${currentBalance}`);
            }

            if (currentBalance <= 0 || currentBalance < netAmount) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            // Deduct immediately from wallet inside transaction
            t.set(profilePrivateRef, {
                wallet_balance: currentBalance - netAmount,
                last_withdrawal_request_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { merge: true });

            // Create withdrawal request
            t.set(withdrawalRef, {
                instructor_id: user.uid,
                instructor_name: user.profile?.full_name || user.email || "محاضر",
                amount: grossAmount,
                commission: commission,
                net_amount: netAmount,
                status: "pending",
                requested_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
            });
        });

        // Log server activity
        await logServerActivity({
            action: "instructor_withdrawal_requested",
            category: "financial",
            title: "طلب سحب أرباح محاضر",
            description: `قام المحاضر "${user.profile?.full_name || user.email}" بطلب سحب مبلغ ${netAmount} ج.م`,
            status: "pending",
            user_id: user.uid,
            user_name: user.profile?.full_name || user.email || "محاضر",
            user_email: user.email,
            user_role: "instructor",
            amount: netAmount,
            metadata: {
                request_id: withdrawalRef.id,
                gross_amount: grossAmount,
                commission: commission,
                net_amount: netAmount,
            },
        });

        return NextResponse.json({ success: true, requestId: withdrawalRef.id });
    } catch (err: any) {
        if (err.message?.startsWith("NEGATIVE_BALANCE")) {
            const bal = err.message.split(":")[1] || "0";
            return NextResponse.json({ 
                error: `لا يمكن تقديم طلب سحب لأن رصيد محفظتك الحالي بالسالب (${bal} ج.م) نتيجة استرداد كورس سابق (Refund/Chargeback). يتم تسوية هذا الرصيد تلقائياً من مبيعات الكورسات القادمة.` 
            }, { status: 400 });
        }
        if (err.message === "PENDING_EXISTS") {
            return NextResponse.json({
                error: "يوجد لديك طلب سحب قيد المعالجة حالياً. يرجى الانتظار حتى يتم إتمام تحويله قبل إرسال طلب جديد."
            }, { status: 400 });
        }
        if (err.message?.startsWith("WEEKLY_LIMIT:")) {
            const lastReqTime = Number(err.message.split(":")[1]) || Date.now();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            const remainingHours = Math.max(1, Math.ceil((sevenDaysMs - (Date.now() - lastReqTime)) / (1000 * 60 * 60)));
            const remainingDays = Math.ceil(remainingHours / 24);
            return NextResponse.json({
                error: `يُسمح بطلب سحب الأرباح مرة واحدة أسبوعياً (كل 7 أيام) لضمان استقرار العمليات البنكية وتفادي نزاعات الاسترداد. يمكنك تقديم طلبك القادم بعد ${remainingDays > 1 ? `${remainingDays} أيام` : `${remainingHours} ساعة`}.`,
                remaining_hours: remainingHours,
                next_eligible_at: new Date(lastReqTime + sevenDaysMs).toISOString(),
            }, { status: 400 });
        }
        if (err.message === "INSUFFICIENT_BALANCE") {
            return NextResponse.json({ error: "عذراً، الرصيد المتاح حالياً أقل من المبلغ المطلوب سحبه" }, { status: 400 });
        }
        if (err.message === "PROFILE_NOT_FOUND") {
            return NextResponse.json({ error: "لم يتم العثور على ملف المحاضر" }, { status: 404 });
        }
        console.error("Withdrawal request error:", err);
        return NextResponse.json({ error: "حدث خطأ أثناء إرسال طلب السحب" }, { status: 500 });
    }
}
