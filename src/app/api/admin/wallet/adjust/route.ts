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
        const userPrivateRef = adminDb.collection("profiles_private").doc(targetUserId);

        await adminDb.runTransaction(async (t) => {
            const [userDoc, userPrivateDoc] = await Promise.all([
                t.get(userRef),
                t.get(userPrivateRef),
            ]);
            if (!userDoc.exists) {
                throw new Error("USER_NOT_FOUND");
            }
            const currentBalance = Number(userPrivateDoc.data()?.wallet_balance ?? userDoc.data()?.wallet_balance ?? 0);

            if (type === "withdraw") {
                if (numAmount > currentBalance) {
                    throw new Error("INSUFFICIENT_BALANCE");
                }
                t.set(userPrivateRef, {
                    wallet_balance: currentBalance - numAmount,
                    updated_at: new Date().toISOString(),
                }, { merge: true });
            } else {
                // recharge
                t.set(userPrivateRef, {
                    wallet_balance: FieldValue.increment(numAmount),
                    updated_at: new Date().toISOString(),
                }, { merge: true });
            }
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.message === "USER_NOT_FOUND") {
            return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        }
        if (err.message === "INSUFFICIENT_BALANCE") {
            return NextResponse.json({ error: "المبلغ المطلوب أكبر من الرصيد الحالي" }, { status: 400 });
        }
        return NextResponse.json({ error: "فشل تعديل الرصيد" }, { status: 500 });
    }
}
