import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
        }
        if (user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 });
        }

        const body = await request.json();
        const { courseId, couponCode } = body;

        if (!courseId) {
            return NextResponse.json({ error: "معرّف الكورس مطلوب" }, { status: 400 });
        }

        const enrollmentId = `${user.uid}_${courseId}`;
        const enrollmentRef = adminDb.collection("enrollments").doc(enrollmentId);
        const courseRef = adminDb.collection("courses").doc(courseId);
        const studentRef = adminDb.collection("profiles").doc(user.uid);

        // Fetch course from server
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const course = courseSnap.data()!;
        const coursePrice = Number(course.price || 0);

        // Validate coupon from server if provided
        let appliedCoupon: any = null;
        let finalPrice = coursePrice;

        if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
            const cleanCode = couponCode.trim().toUpperCase();
            const couponSnap = await adminDb
                .collection("coupons")
                .where("code", "==", cleanCode)
                .limit(1)
                .get();

            if (!couponSnap.empty) {
                const cDoc = couponSnap.docs[0];
                const cData = cDoc.data();
                const now = new Date();
                const validUntil = cData.valid_until ? new Date(cData.valid_until) : null;
                const isExpired = validUntil && validUntil < now;
                const isExhausted = cData.usage_limit && (cData.usage_count || 0) >= cData.usage_limit;
                const isCourseMatch = !cData.course_id || cData.course_id === courseId;

                if (!isExpired && !isExhausted && isCourseMatch && cData.is_active !== false) {
                    appliedCoupon = { id: cDoc.id, ...cData };
                    const discount = (coursePrice * Number(cData.discount_percent || 0)) / 100;
                    finalPrice = Math.max(0, coursePrice - discount);
                } else {
                    return NextResponse.json({ error: "الكوبون غير صالح أو منتهي الصلاحية" }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: "كود الكوبون غير موجود" }, { status: 400 });
            }
        }

        const instructorRef = course.instructor_id ? adminDb.collection("profiles").doc(course.instructor_id) : null;
        const txLogRef = adminDb.collection("transactions").doc();

        // Run atomic transaction on server
        await adminDb.runTransaction(async (t) => {
            const existingEnrollment = await t.get(enrollmentRef);
            if (existingEnrollment.exists) {
                throw new Error("ALREADY_ENROLLED");
            }

            const studentSnap = await t.get(studentRef);
            if (!studentSnap.exists) {
                throw new Error("STUDENT_NOT_FOUND");
            }
            const studentData = studentSnap.data()!;
            const currentBalance = Number(studentData.wallet_balance || 0);

            if (finalPrice > 0) {
                if (currentBalance < finalPrice) {
                    throw new Error(`INSUFFICIENT_BALANCE:${finalPrice}:${currentBalance}`);
                }

                // Deduct from student
                t.update(studentRef, {
                    wallet_balance: currentBalance - finalPrice,
                    updated_at: new Date().toISOString(),
                });

                // Add 95% to instructor
                if (instructorRef) {
                    const instructorEarnings = finalPrice * 0.95;
                    const platformCommission = finalPrice * 0.05;

                    t.update(instructorRef, {
                        wallet_balance: FieldValue.increment(instructorEarnings),
                        updated_at: new Date().toISOString(),
                    });

                    // Audit log
                    t.create(txLogRef, {
                        type: "enrollment_payout",
                        amount: finalPrice,
                        instructor_id: course.instructor_id,
                        instructor_share: instructorEarnings,
                        platform_commission: platformCommission,
                        student_id: user.uid,
                        student_name: studentData.full_name || user.email,
                        course_id: courseId,
                        course_title: course.title,
                        coupon_used: appliedCoupon?.code || null,
                        created_at: new Date().toISOString(),
                    });
                }
            }

            // Create enrollment
            t.set(enrollmentRef, {
                id: enrollmentId,
                student_id: user.uid,
                student_name: studentData.full_name || user.email,
                student_unique_id: studentData.student_id || "N/A",
                course_id: courseId,
                course_title: course.title,
                instructor_id: course.instructor_id || "",
                instructor_name: course.instructor_name || "",
                enrolled_at: new Date().toISOString(),
                progress: 0,
                status: "active",
                paid_amount: finalPrice,
                original_price: coursePrice,
                coupon_used: appliedCoupon?.code || null,
            });

            // Increment coupon usage
            if (appliedCoupon) {
                const cRef = adminDb.collection("coupons").doc(appliedCoupon.id);
                t.update(cRef, { usage_count: FieldValue.increment(1) });
            }

            // Increment students_count
            t.update(courseRef, { students_count: FieldValue.increment(1) });
        });

        // Log server activity
        await logServerActivity({
            action: "course_enrolled",
            category: finalPrice > 0 ? "financial" : "course",
            title: finalPrice > 0 ? "شراء واشتراك في كورس" : "اشتراك في كورس مجاني",
            description: `تم اشتراك الطالب في كورس "${course.title}" بمبلغ ${finalPrice} ج.م`,
            status: "success",
            user_id: user.uid,
            user_name: user.profile?.full_name || user.email,
            user_email: user.email,
            user_role: "student",
            amount: finalPrice,
            metadata: {
                course_id: courseId,
                paid_amount: finalPrice,
                coupon: appliedCoupon?.code,
            },
        });

        return NextResponse.json({ success: true, enrollmentId, paidAmount: finalPrice });
    } catch (err: any) {
        if (err.message === "ALREADY_ENROLLED") {
            return NextResponse.json({ error: "أنت مسجل بالفعل في هذا الكورس" }, { status: 400 });
        }
        if (err.message?.startsWith("INSUFFICIENT_BALANCE")) {
            const [, needed, current] = err.message.split(":");
            return NextResponse.json({ error: `رصيدك غير كافٍ. تحتاج إلى ${needed} ج.م بينما رصيدك ${current} ج.م.` }, { status: 400 });
        }
        return NextResponse.json({ error: err.message || "فشل الاشتراك في الكورس" }, { status: 500 });
    }
}
