import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
    try {
        const adminUser = await getServerAuth(request);
        if (!adminUser || adminUser.role !== "admin") {
            return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
        }

        const body = await request.json();
        const { targetUserId, amount, type } = body;

        const numAmount = Number(amount);
        if (!targetUserId || !numAmount || numAmount <= 0) {
            return NextResponse.json({ error: "بيانات العملية غير صحيحة" }, { status: 400 });
        }

        const userRef = adminDb.collection("profiles").doc(targetUserId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        }

        const currentBalance = Number(userDoc.data()?.wallet_balance || 0);

        if (type === "withdraw") {
            if (numAmount > currentBalance) {
                return NextResponse.json({ error: "المبلغ المطلوب أكبر من الرصيد الحالي" }, { status: 400 });
            }
            await userRef.update({
                wallet_balance: currentBalance - numAmount,
                updated_at: new Date().toISOString(),
            });
        } else {
            // recharge
            await userRef.update({
                wallet_balance: FieldValue.increment(numAmount),
                updated_at: new Date().toISOString(),
            });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "فشل تعديل الرصيد" }, { status: 500 });
    }
}
