import { NextResponse } from "next/server";
import { ONLINE_PAYMENTS_ENABLED, ONLINE_PAYMENTS_DISABLED_MESSAGE } from "@/lib/payments/gateway-flag";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveServerAuth } from "@/lib/server-auth";
import { createFawaterakTransaction } from "@/lib/payments/fawaterak";
import { checkRateLimitAsync } from "@/lib/rate-limiter";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    if (!ONLINE_PAYMENTS_ENABLED) {
        return NextResponse.json({ error: ONLINE_PAYMENTS_DISABLED_MESSAGE, code: "ONLINE_PAYMENTS_DISABLED" }, { status: 503 });
    }
    try {
        const body = await request.json();
        const { courseId, couponCode } = body;

        if (!courseId) {
            return NextResponse.json({ error: "معرّف الكورس مطلوب" }, { status: 400 });
        }

        // 1. Authenticate via session cookie only (checkRevoked + account status enforced centrally)
        const authUser = await getActiveServerAuth(request);
        const uid = authUser?.uid || "";
        const userEmail = authUser?.email || "";
        const displayName = authUser?.profile?.full_name || "";

        if (!uid) {
            return NextResponse.json(
                { error: "يرجى تسجيل الدخول أولاً لإتمام عملية الشراء" },
                { status: 401 }
            );
        }

        // 2. Strict Rate Limiting: 5 attempts per 2 minutes
        if (!(await checkRateLimitAsync(`pay_course_${uid}`, 5, 120)).success) {
            return NextResponse.json(
                { error: "تم تجاوز الحد الأقصى للمحاولات، يرجى الانتظار دقيقتين قبل المحاولة مرة أخرى" },
                { status: 429 }
            );
        }

        // 3. Fetch course
        const courseSnap = await adminDb.collection("courses").doc(courseId).get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const course = courseSnap.data()!;
        if (course.status !== "approved" || course.is_published === false) {
            return NextResponse.json({ error: "الكورس غير متاح للشراء حالياً" }, { status: 400 });
        }

        // Prevent instructor from buying their own course
        if (course.instructor_id === uid) {
            return NextResponse.json({ error: "لا يمكنك شراء كورسك الخاص" }, { status: 400 });
        }

        // Check if student already enrolled
        const enrollmentSnap = await adminDb.collection("enrollments").doc(`${uid}_${courseId}`).get();
        if (enrollmentSnap.exists) {
            return NextResponse.json({ error: "أنت مشترك بالفعل في هذا الكورس" }, { status: 400 });
        }

        const coursePrice = Number(course.price || 0);
        let finalPrice = coursePrice;

        // 4. Validate coupon if provided
        if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
            const cleanCode = couponCode.trim().toUpperCase();
            const couponSnap = await adminDb
                .collection("coupons")
                .where("code", "==", cleanCode)
                .limit(1)
                .get();

            if (couponSnap.empty) {
                return NextResponse.json({ error: "كود الكوبون غير صحيح" }, { status: 400 });
            }

            const cData = couponSnap.docs[0].data();
            const now = new Date();
            const validUntil = cData.valid_until ? new Date(cData.valid_until) : null;
            const isExpired = validUntil && validUntil < now;
            const maxUses = cData.max_uses ?? cData.usage_limit ?? null;
            const isExhausted = maxUses !== null && (cData.usage_count || 0) >= maxUses;
            const isCourseMatch = cData.course_id === "all" || !cData.course_id || cData.course_id === courseId;
            const isAdminCoupon = cData.is_admin === true || cData.instructor_id === "admin" || (cData.course_id === "all" && !cData.instructor_id);
            const isInstructorMatch = isAdminCoupon || (cData.instructor_id === course.instructor_id);
            const discountPercent = Number(cData.discount_percent);
            const isActive = cData.active !== false && cData.is_active !== false;

            if (isExpired || isExhausted || !isCourseMatch || !isInstructorMatch || !isActive || isNaN(discountPercent)) {
                return NextResponse.json(
                    { error: "الكوبون غير صالح أو منتهي الصلاحية أو تم استنفاد الحد الأقصى لاستخدامه" },
                    { status: 400 }
                );
            }

            const discount = (coursePrice * discountPercent) / 100;
            finalPrice = Math.max(0, coursePrice - discount);
        }

        if (finalPrice < 5) {
            return NextResponse.json(
                { error: "الحد الأدنى للدفع الإلكتروني المباشر عبر فواتيرك هو 5 ج.م. إذا كان الكورس مجانياً أو أقل من 5 ج.م يمكنك الاشتراك مباشرة من رصيد المحفظة." },
                { status: 400 }
            );
        }

        // 5. Fetch student profile details
        const [profileSnap, privateSnap] = await Promise.all([
            adminDb.collection("profiles").doc(uid).get(),
            adminDb.collection("profiles_private").doc(uid).get(),
        ]);
        const profileData = profileSnap.exists ? profileSnap.data() : {};
        const privateData = privateSnap.exists ? privateSnap.data() : {};

        const fullName = profileData?.full_name || displayName || "طالب المنارة";
        const [firstName, ...restName] = fullName.trim().split(" ");
        const lastName = restName.join(" ") || "المحترم";
        const email = privateData?.email || profileData?.email || userEmail || `student_${uid}@manara.academy`;
        const phone = privateData?.phone || privateData?.phone_number || profileData?.phone || profileData?.phone_number || "01000000000";

        // 6. Base URL
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "manara-academy.vercel.app";
        const proto = request.headers.get("x-forwarded-proto") || "https";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

        const instructorEarnings = finalPrice * 0.95;
        const platformCommission = finalPrice * 0.05;

        // 7. Create Fawaterak Transaction for direct educational service
        const sessionResult = await createFawaterakTransaction({
            amount: finalPrice,
            customer: {
                firstName: firstName.trim().substring(0, 50),
                lastName: lastName.trim().substring(0, 50),
                email: email.trim(),
                phone: phone.trim(),
                uniqueId: profileData?.student_id || uid,
            },
            studentId: uid,
            baseUrl,
            itemName: `شراء دورة تعليمية: ${course.title.trim().substring(0, 80)}`,
            type: "course_purchase",
            courseId,
            customSuccessUrl: `${baseUrl}/learn/${courseId}?payment=success`,
            customFailUrl: `${baseUrl}/courses/${courseId}?payment=failed`,
            customPendingUrl: `${baseUrl}/courses/${courseId}?payment=pending`,
            metadata: {
                course_id: courseId,
                course_title: course.title,
                instructor_id: course.instructor_id,
            },
        });

        // 8. Record pending order in course_orders collection
        const orderRef = await adminDb.collection("course_orders").add({
            student_id: uid,
            student_name: fullName,
            student_email: email,
            student_unique_id: profileData?.student_id || "N/A",
            course_id: courseId,
            course_title: course.title,
            instructor_id: course.instructor_id || "",
            instructor_name: course.instructor_name || "",
            original_price: coursePrice,
            amount: finalPrice,
            instructor_share: instructorEarnings,
            platform_commission: platformCommission,
            coupon_code: couponCode || null,
            fawaterak_intent_key: sessionResult.intentKey,
            payment_gateway: "fawaterak",
            status: "pending_payment",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        // 9. Audit log
        await logServerActivity({
            action: "fawaterak_course_payment_initiated",
            category: "financial",
            title: `بدء شراء كورس إلكترونياً (${course.title})`,
            description: `قام الطالب "${fullName}" ببدء شراء كورس "${course.title}" بقيمة ${finalPrice} ج.م عبر فواتيرك`,
            status: "pending",
            user_id: uid,
            user_name: fullName,
            user_email: email,
            user_role: "student",
            amount: finalPrice,
            metadata: {
                course_id: courseId,
                course_title: course.title,
                order_id: orderRef.id,
                intent_key: sessionResult.intentKey,
            },
        });

        return NextResponse.json({
            status: "success",
            paymentUrl: sessionResult.paymentUrl,
            intentKey: sessionResult.intentKey,
        });
    } catch (error: any) {
        console.error("Initiate course payment error:", error);
        return NextResponse.json(
            { error: error.message || "حدث خطأ أثناء التواصل مع بوابة الدفع" },
            { status: 500 }
        );
    }
}
