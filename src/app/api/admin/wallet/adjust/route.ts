import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { activityLogRole, logRouteFailure, requirePermission } from "@/lib/server-auth";
import { FieldValue } from "firebase-admin/firestore";
import { logServerActivity } from "@/lib/server-activity-logger";
import { isBackofficeRole } from "@/lib/permissions";

export async function POST(request: Request) {
    let logTarget = "";
    let logAmount = 0;
    let logType = "";
    try {
        const adminUser = await requirePermission(request, "wallet.adjust");
        if (!adminUser) {
            return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
        }

        const body = await request.json();
        const { targetUserId, amount, type } = body;

        const numAmount = Number(amount);
        logTarget = typeof targetUserId === "string" ? targetUserId : "";
        logAmount = Number.isFinite(numAmount) ? numAmount : 0;
        logType = type === "withdraw" ? "withdraw" : "recharge";
        const isValidTarget = typeof targetUserId === "string" && !!targetUserId.trim() && targetUserId.length <= 128 && !targetUserId.includes("/");
        const isValidAmount = typeof amount !== "boolean" && amount !== null && amount !== "" && Number.isFinite(numAmount) && numAmount > 0 && numAmount <= 50000;
        if (!isValidTarget || !isValidAmount) {
            await logRouteFailure(request, {
                action: "admin_wallet_adjust_failed",
                category: "financial",
                title: "فشل تعديل رصيد محفظة",
                description: `بيانات غير صحيحة لتعديل رصيد المستخدم ${logTarget || "(غير محدد)"} بمبلغ ${String(amount).slice(0, 30)}`,
                user: adminUser,
                target_user_id: logTarget || undefined,
            });
            return NextResponse.json({ error: "بيانات العملية غير صحيحة (الحد الأقصى للمبلغ 50000 ج.م)" }, { status: 400 });
        }

        if (targetUserId === adminUser.uid) {
            await logRouteFailure(request, {
                action: "admin_wallet_adjust_failed",
                category: "financial",
                title: "محاولة تعديل رصيد المحفظة الشخصية",
                description: `محاولة ${logType === "withdraw" ? "خصم" : "إيداع"} مبلغ ${numAmount} ج.م في محفظة المنفّذ نفسه (غير مسموح)`,
                user: adminUser,
                target_user_id: targetUserId,
                amount: numAmount,
            });
            return NextResponse.json({ error: "لا يمكنك تعديل رصيد محفظتك الشخصية" }, { status: 403 });
        }

        const userRef = adminDb.collection("profiles").doc(targetUserId);
        const userPrivateRef = adminDb.collection("profiles_private").doc(targetUserId);
        const txRef = adminDb.collection("transactions").doc();

        let targetUserData: any = null;

        await adminDb.runTransaction(async (t) => {
            const [userDoc, userPrivateDoc] = await Promise.all([
                t.get(userRef),
                t.get(userPrivateRef),
            ]);
            if (!userDoc.exists) {
                throw new Error("USER_NOT_FOUND");
            }
            targetUserData = userDoc.data();
            // Only the admin may adjust wallets of admin/staff (backoffice) accounts
            if (adminUser.role !== "admin" && isBackofficeRole(targetUserData?.role)) {
                throw new Error("TARGET_FORBIDDEN");
            }
            const currentBalance = Number(userPrivateDoc.data()?.wallet_balance ?? 0);

            if (type === "withdraw") {
                if (numAmount > currentBalance) {
                    throw new Error("INSUFFICIENT_BALANCE");
                }
                t.set(userPrivateRef, {
                    wallet_balance: currentBalance - numAmount,
                    updated_at: new Date().toISOString(),
                }, { merge: true });

                t.create(txRef, {
                    type: "admin_manual_deduct",
                    student_id: targetUserId,
                    student_name: targetUserData.full_name || "مستخدم",
                    student_email: targetUserData.email || "",
                    amount: numAmount,
                    admin_id: adminUser.uid,
                    admin_name: adminUser.profile?.full_name || adminUser.email || "الإدارة",
                    status: "completed",
                    details: "خصم رصيد يدوي بواسطة إدارة المنصة",
                    created_at: new Date().toISOString(),
                });
            } else {
                // recharge
                t.set(userPrivateRef, {
                    wallet_balance: FieldValue.increment(numAmount),
                    updated_at: new Date().toISOString(),
                }, { merge: true });

                t.create(txRef, {
                    type: "admin_manual_credit",
                    student_id: targetUserId,
                    student_name: targetUserData.full_name || "مستخدم",
                    student_email: targetUserData.email || "",
                    amount: numAmount,
                    admin_id: adminUser.uid,
                    admin_name: adminUser.profile?.full_name || adminUser.email || "الإدارة",
                    status: "completed",
                    details: "إيداع رصيد يدوي / مكافأة بواسطة إدارة المنصة",
                    created_at: new Date().toISOString(),
                });
            }
        });

        // Audit log
        await logServerActivity({
            action: type === "withdraw" ? "admin_manual_deduct" : "admin_manual_recharge",
            category: "financial",
            title: type === "withdraw" ? "خصم رصيد يدوي بواسطة الإدارة" : "إيداع رصيد يدوي بواسطة الإدارة",
            description: `قام المسؤول "${adminUser.profile?.full_name || adminUser.email || 'المدير'}" بـ ${type === 'withdraw' ? 'خصم' : 'إيداع'} مبلغ ${numAmount} ج.م في محفظة المستخدم "${targetUserData?.full_name || targetUserId}"`,
            status: "success",
            user_id: adminUser.uid,
            user_name: adminUser.profile?.full_name || adminUser.email || "مسؤول المنصة",
            user_email: adminUser.email || "",
            user_role: activityLogRole(adminUser),
            target_user_id: targetUserId,
            target_user_name: targetUserData?.full_name,
            amount: type === "withdraw" ? -numAmount : numAmount,
            metadata: {
                target_user_id: targetUserId,
                amount: numAmount,
                type,
                transaction_id: txRef.id,
            },
        });

        return NextResponse.json({ success: true, transactionId: txRef.id });
    } catch (err: any) {
        await logRouteFailure(request, {
            action: "admin_wallet_adjust_failed",
            category: "financial",
            title: logType === "withdraw" ? "فشل خصم رصيد يدوي" : "فشل إيداع رصيد يدوي",
            description: `تعذر ${logType === "withdraw" ? "خصم" : "إيداع"} مبلغ ${logAmount} ج.م لمحفظة المستخدم ${logTarget || "(غير محدد)"}`,
            error: err,
            target_user_id: logTarget || undefined,
            amount: logAmount,
            metadata: { type: logType },
        });
        if (err.message === "USER_NOT_FOUND") {
            return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        }
        if (err.message === "TARGET_FORBIDDEN") {
            return NextResponse.json({ error: "غير مسموح بتعديل رصيد حسابات الإدارة أو فريق العمل" }, { status: 403 });
        }
        if (err.message === "INSUFFICIENT_BALANCE") {
            return NextResponse.json({ error: "المبلغ المطلوب أكبر من الرصيد الحالي" }, { status: 400 });
        }
        return NextResponse.json({ error: "فشل تعديل الرصيد" }, { status: 500 });
    }
}
