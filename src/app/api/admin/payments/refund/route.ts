import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية (مخصصة للمسؤول فقط)" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { orderId, intentKey, reason } = body;

        if (!orderId && !intentKey) {
            return NextResponse.json({ error: "معرّف الطلب أو مفتاح المعاملة مطلوب" }, { status: 400 });
        }

        let orderDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
        if (orderId) {
            const snap = await adminDb.collection("course_orders").doc(orderId).get();
            if (snap.exists) orderDoc = snap;
        }

        if (!orderDoc && intentKey) {
            const snap = await adminDb
                .collection("course_orders")
                .where("fawaterak_intent_key", "==", intentKey)
                .limit(1)
                .get();
            if (!snap.empty) orderDoc = snap.docs[0];
        }

        if (!orderDoc || !orderDoc.exists) {
            return NextResponse.json({ error: "لم يتم العثور على طلب الكورس المطلوب استرداده" }, { status: 404 });
        }

        const orderData = orderDoc.data()!;
        if (orderData.status === "refunded") {
            return NextResponse.json({ error: "هذا الطلب تم استرداده وإلغاؤه مسبقاً" }, { status: 400 });
        }

        const studentId = orderData.student_id;
        const courseId = orderData.course_id;
        const instructorId = orderData.instructor_id;
        const finalPaid = Number(orderData.amount || 0);
        const instructorShare = Number(orderData.instructor_share ?? (finalPaid * 0.95));

        const enrollmentRef = adminDb.collection("enrollments").doc(`${studentId}_${courseId}`);
        const courseRef = adminDb.collection("courses").doc(courseId);
        const instructorProfileRef = instructorId ? adminDb.collection("profiles").doc(instructorId) : null;
        const instructorPrivateRef = instructorId ? adminDb.collection("profiles_private").doc(instructorId) : null;
        const studentProfileRef = adminDb.collection("profiles").doc(studentId);
        const refundTxRef = adminDb.collection("transactions").doc(`refund_admin_${orderDoc.id}`);

        await adminDb.runTransaction(async (t) => {
            // A. Mark order as refunded
            t.update(orderDoc!.ref, {
                status: "refunded",
                refund_reason: reason || "admin_manual_refund",
                refunded_by: user.uid,
                refunded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            // B. Revoke enrollment
            t.set(enrollmentRef, {
                status: "refunded",
                revoked_at: new Date().toISOString(),
                refund_reason: reason || "admin_manual_refund",
            }, { merge: true });

            // C. Remove course from student profile
            t.update(studentProfileRef, {
                enrolled_courses: FieldValue.arrayRemove(courseId),
                updated_at: new Date().toISOString(),
            });

            // D. Decrement course student counter
            t.update(courseRef, {
                students_count: FieldValue.increment(-1),
            });

            // E. Deduct instructor share (allows negative balance)
            if (instructorPrivateRef) {
                t.set(instructorPrivateRef, {
                    wallet_balance: FieldValue.increment(-instructorShare),
                    updated_at: new Date().toISOString(),
                }, { merge: true });
            }
            if (instructorProfileRef) {
                t.set(instructorProfileRef, {
                    wallet_balance: FieldValue.increment(-instructorShare),
                    total_earned: FieldValue.increment(-instructorShare),
                    updated_at: new Date().toISOString(),
                }, { merge: true });
            }

            // F. Add record in transactions
            t.set(refundTxRef, {
                type: "course_refund_manual_admin",
                order_id: orderDoc!.id,
                original_intent_key: orderData.fawaterak_intent_key || "N/A",
                student_id: studentId,
                student_name: orderData.student_name || "طالب",
                course_id: courseId,
                course_title: orderData.course_title || "",
                instructor_id: instructorId || "",
                amount: finalPaid,
                instructor_deduction: instructorShare,
                platform_deduction: Number(orderData.platform_commission || 0),
                status: "refunded",
                refund_reason: reason || "admin_manual_refund",
                refunded_by: user.uid,
                created_at: new Date().toISOString(),
            });
        });

        // Audit log
        await logServerActivity({
            action: "admin_course_refund",
            category: "financial",
            title: `استرداد يدوي لكورس بواسطة الإدارة (${orderData.course_title})`,
            description: `قام المسؤول "${user.email}" بإلغاء اشتراك الطالب "${orderData.student_name}" واسترداد مبلغ ${finalPaid} ج.م وخصم ${instructorShare} ج.م من المدرس`,
            status: "info",
            user_id: user.uid,
            user_name: user.profile?.full_name || "مسؤول",
            amount: finalPaid,
            metadata: {
                order_id: orderDoc.id,
                course_id: courseId,
                instructor_id: instructorId,
                student_id: studentId,
                reason,
            },
        });

        return NextResponse.json({
            success: true,
            message: "تم استرداد الكورس وإلغاء اشتراك الطالب وخصم حصة المدرس بنجاح",
            refundedAmount: finalPaid,
            instructorDeduction: instructorShare,
        });
    } catch (err: any) {
        console.error("Admin refund error:", err);
        return NextResponse.json({ error: err.message || "فشل تنفيذ الاسترداد" }, { status: 500 });
    }
}
