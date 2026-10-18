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
        const studentPrivateRef = adminDb.collection("profiles_private").doc(user.uid);

        // Fetch course from server
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const course = courseSnap.data()!;
        if (course.status !== "approved" || course.is_published === false) {
            return NextResponse.json({ error: "الكورس غير متاح للاشتراك حالياً" }, { status: 400 });
        }
        const coursePrice = Number(course.price || 0);

        // Prevent instructor from enrolling in their own course
        if (course.instructor_id === user.uid) {
            return NextResponse.json({ error: "لا يمكنك الاشتراك في كورسك الخاص" }, { status: 400 });
        }

        // Prevent instructors from purchasing courses (wallet is for withdrawals only)
        if (user.role === "instructor" && coursePrice > 0) {
            return NextResponse.json({ error: "محفظة المدرس مخصصة للسحب فقط ولا يمكن استخدامها لشراء الكورسات" }, { status: 403 });
        }

        // Resolve coupon ref ahead of time (but validate inside transaction)
        let couponRef: FirebaseFirestore.DocumentReference | null = null;
        if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
            const cleanCode = couponCode.trim().toUpperCase();
            const couponSnap = await adminDb
                .collection("coupons")
                .where("code", "==", cleanCode)
                .limit(1)
                .get();
            if (couponSnap.empty) {
                return NextResponse.json({ error: "كود الكوبون غير موجود" }, { status: 400 });
            }
            couponRef = couponSnap.docs[0].ref;
        }

        const instructorPrivateRef = course.instructor_id ? adminDb.collection("profiles_private").doc(course.instructor_id) : null;
        const txLogRef = adminDb.collection("transactions").doc();

        // Run atomic transaction on server
        const result = await adminDb.runTransaction(async (t) => {
            const existingEnrollment = await t.get(enrollmentRef);
            if (existingEnrollment.exists) {
                throw new Error("ALREADY_ENROLLED");
            }

            const [studentSnap, studentPrivateSnap] = await Promise.all([
                t.get(studentRef),
                t.get(studentPrivateRef),
            ]);
            if (!studentSnap.exists) {
                throw new Error("STUDENT_NOT_FOUND");
            }
            const studentData = studentSnap.data()!;
            const studentPrivateData = studentPrivateSnap.exists ? studentPrivateSnap.data()! : {};
            const currentBalance = Number(studentPrivateData.wallet_balance ?? 0);

            // Validate coupon inside transaction (TOCTOU-safe)
            let appliedCoupon: any = null;
            let finalPrice = coursePrice;

            if (couponRef) {
                const cSnap = await t.get(couponRef);
                if (!cSnap.exists) {
                    throw new Error("COUPON_NOT_FOUND");
                }
                const cData = cSnap.data()!;
                const now = new Date();
                const validUntil = cData.valid_until ? new Date(cData.valid_until) : null;
                const isExpired = validUntil && validUntil < now;
                const maxUses = cData.max_uses ?? cData.usage_limit ?? null;
                const isExhausted = maxUses !== null && (cData.usage_count || 0) >= maxUses;
                const isCourseMatch = cData.course_id === "all" || !cData.course_id || cData.course_id === courseId;
                
                // Coupon must belong to course instructor unless created by admin
                const isAdminCoupon = cData.is_admin === true || cData.instructor_id === "admin" || (cData.course_id === "all" && !cData.instructor_id);
                const isInstructorMatch = isAdminCoupon || (cData.instructor_id === course.instructor_id);
                
                const discountPercent = Number(cData.discount_percent);
                const isDiscountValid = !isNaN(discountPercent) && discountPercent >= 0 && discountPercent <= 100;
                const isActive = cData.active !== false && cData.is_active !== false;

                if (isExpired || isExhausted || !isCourseMatch || !isInstructorMatch || !isDiscountValid || !isActive) {
                    throw new Error("COUPON_INVALID");
                }
                appliedCoupon = { id: cSnap.id, ...cData };
                const discount = (coursePrice * discountPercent) / 100;
                finalPrice = Math.max(0, coursePrice - discount);
            }

            if (finalPrice > 0) {
                if (currentBalance < finalPrice) {
                    throw new Error(`INSUFFICIENT_BALANCE:${finalPrice}:${currentBalance}`);
                }

                // Deduct from student's private profile
                t.set(studentPrivateRef, {
                    wallet_balance: currentBalance - finalPrice,
                    updated_at: new Date().toISOString(),
                }, { merge: true });

                // Add 95% to instructor (only if instructor profile exists)
                if (instructorPrivateRef) {
                    const instructorEarnings = finalPrice * 0.95;
                    const platformCommission = finalPrice * 0.05;

                    t.set(instructorPrivateRef, {
                        wallet_balance: FieldValue.increment(instructorEarnings),
                        updated_at: new Date().toISOString(),
                    }, { merge: true });

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
                student_unique_id: studentPrivateData.student_id || studentData.student_id || "N/A",
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

            // Increment coupon usage inside transaction
            if (appliedCoupon && couponRef) {
                t.update(couponRef, { usage_count: FieldValue.increment(1) });
            }

            // Increment students_count
            t.update(courseRef, { students_count: FieldValue.increment(1) });

            return { finalPrice, appliedCoupon };
        });

        // 1. Log student course purchase
        const studentName = user.profile?.full_name || user.email || "طالب";
        const instructorName = course.instructor_name || "محاضر";
        
        await logServerActivity({
            action: "course_enrolled",
            category: result.finalPrice > 0 ? "financial" : "course",
            title: result.finalPrice > 0 ? `شراء كورس (${course.title})` : `اشتراك مجاني (${course.title})`,
            description: `اشترك الطالب "${studentName}" في كورس "${course.title}" للمدرس "${instructorName}" بقيمة ${result.finalPrice} ج.م${result.appliedCoupon?.code ? ` (تم تطبيق كوبون: ${result.appliedCoupon.code})` : ''}`,
            status: "success",
            user_id: user.uid,
            user_name: studentName,
            user_email: user.email,
            user_role: "student",
            amount: result.finalPrice,
            metadata: {
                course_id: courseId,
                course_title: course.title,
                instructor_id: course.instructor_id,
                instructor_name: instructorName,
                paid_amount: result.finalPrice,
                original_price: coursePrice,
                coupon_used: result.appliedCoupon?.code || null,
            },
        });

        // 2. Log instructor payout if price > 0
        if (result.finalPrice > 0 && course.instructor_id) {
            const instructorEarnings = result.finalPrice * 0.95;
            const platformCommission = result.finalPrice * 0.05;

            await logServerActivity({
                action: "instructor_payout",
                category: "financial",
                title: `تحويل أرباح لمحفظة المدرس (${instructorName})`,
                description: `تم تحويل مبلغ ${instructorEarnings} ج.م (نسبة 95%) لمحفظة المدرس "${instructorName}" نظير اشتراك الطالب "${studentName}" في كورس "${course.title}". عمولة المنصة 5%: ${platformCommission} ج.م.`,
                status: "success",
                user_id: course.instructor_id,
                user_name: instructorName,
                user_role: "instructor",
                target_user_id: user.uid,
                target_user_name: studentName,
                amount: instructorEarnings,
                metadata: {
                    course_id: courseId,
                    course_title: course.title,
                    student_id: user.uid,
                    student_name: studentName,
                    total_amount: result.finalPrice,
                    instructor_earnings: instructorEarnings,
                    platform_commission: platformCommission,
                },
            });
        }

        return NextResponse.json({ success: true, enrollmentId, paidAmount: result.finalPrice });
    } catch (err: any) {
        if (err.message === "ALREADY_ENROLLED") {
            return NextResponse.json({ error: "أنت مسجل بالفعل في هذا الكورس" }, { status: 400 });
        }
        if (err.message?.startsWith("INSUFFICIENT_BALANCE")) {
            const [, needed, current] = err.message.split(":");
            return NextResponse.json({ error: `رصيدك غير كافٍ. تحتاج إلى ${needed} ج.م بينما رصيدك ${current} ج.م.` }, { status: 400 });
        }
        if (err.message === "COUPON_INVALID") {
            return NextResponse.json({ error: "الكوبون غير صالح أو منتهي الصلاحية" }, { status: 400 });
        }
        if (err.message === "COUPON_NOT_FOUND" || err.message === "INSTRUCTOR_NOT_FOUND") {
            return NextResponse.json({ error: "خطأ في البيانات، تواصل مع الدعم" }, { status: 400 });
        }
        console.error("Course enroll error:", err);
        return NextResponse.json({ error: "فشل الاشتراك في الكورس" }, { status: 500 });
    }
}
