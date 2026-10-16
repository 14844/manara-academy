import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
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
        const grossAmount = Number(body.amount || 0);
        const commission = Number(body.commission || 0);
        const netAmount = Number(body.net_amount || 0);

        if (netAmount <= 0) {
            return NextResponse.json({ error: "المبلغ المطلوب سحبه غير صالح" }, { status: 400 });
        }

        const profileRef = adminDb.collection("profiles").doc(user.uid);
        const withdrawalRef = adminDb.collection("withdrawal_requests").doc();

        await adminDb.runTransaction(async (t) => {
            const pSnap = await t.get(profileRef);
            if (!pSnap.exists) {
                throw new Error("PROFILE_NOT_FOUND");
            }

            const currentBalance = Number(pSnap.data()?.wallet_balance || 0);
            if (currentBalance < netAmount) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            // Deduct immediately from wallet inside transaction
            t.update(profileRef, {
                wallet_balance: currentBalance - netAmount,
                updated_at: new Date().toISOString(),
            });

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
