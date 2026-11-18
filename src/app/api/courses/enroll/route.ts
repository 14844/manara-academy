import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getActiveServerAuth, logRouteFailure } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { PLANS, computeSaleSplit, formatRate, getEffectivePlan, type CouponSource, type PlanId } from "@/lib/plans";
import { couponSourceOf, saleFields } from "@/lib/sales";
import { checkRateLimitAsync } from "@/lib/rate-limiter";

export async function POST(request: Request) {
    let logCourseId = "";
    let logCoupon = "";
    try {
        const user = await getActiveServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
        }
        if (user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 });
        }

        // Per-user rate limit (also throttles coupon-code guessing)
        if (!(await checkRateLimitAsync(`enroll_${user.uid}`, 10, 60)).success) {
            return NextResponse.json({ error: "محاولات كثيرة، يرجى الانتظار دقيقة ثم المحاولة مجدداً" }, { status: 429 });
        }

        const body = await request.json();
        const { courseId, couponCode } = body;
        logCourseId = typeof courseId === "string" ? courseId.slice(0, 128) : "";
        logCoupon = typeof couponCode === "string" ? couponCode.slice(0, 64) : "";

        if (!courseId || typeof courseId !== "string" || courseId.includes("/")) {
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
        const coursePrice = Math.max(0, Number(course.price || 0) || 0);

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
                .limit(10)
                .get();
            // Codes aren't unique across owners: pick the one usable on this course (a platform coupon or
            // this course instructor's own), so another instructor can't shadow a platform code.
            const match = couponSnap.docs.find((d) => {
                const c = d.data();
                return couponSourceOf(c) === "platform" || c.instructor_id === course.instructor_id;
            });
            if (!match) {
                // Same generic message as an invalid coupon (don't reveal which codes exist)
                throw new Error("COUPON_INVALID");
            }
            couponRef = match.ref;
        }

        const instructorId: string = typeof course.instructor_id === "string" ? course.instructor_id : "";
        const instructorPrivateRef = instructorId ? adminDb.collection("profiles_private").doc(instructorId) : null;
        const txLogRef = adminDb.collection("transactions").doc();

        // Run atomic transaction on server
        const result = await adminDb.runTransaction(async (t) => {
            const existingEnrollment = await t.get(enrollmentRef);
            if (existingEnrollment.exists) {
                throw new Error("ALREADY_ENROLLED");
            }

            const [studentSnap, studentPrivateSnap, instructorPrivateSnap, cSnap] = await Promise.all([
                t.get(studentRef),
                t.get(studentPrivateRef),
                instructorPrivateRef ? t.get(instructorPrivateRef) : Promise.resolve(null),
                couponRef ? t.get(couponRef) : Promise.resolve(null),
            ]);
            if (!studentSnap.exists) {
                throw new Error("STUDENT_NOT_FOUND");
            }
            const studentData = studentSnap.data()!;
            const studentPrivateData = studentPrivateSnap.exists ? studentPrivateSnap.data()! : {};
            const currentBalance = Number(studentPrivateData.wallet_balance ?? 0);

            // The plan active for the instructor right now decides the commission of this sale
            const eff = getEffectivePlan(instructorPrivateSnap?.exists ? instructorPrivateSnap.data() : null);
            const planId: PlanId = eff.planId;

            // Validate coupon inside transaction (TOCTOU-safe)
            let appliedCoupon: any = null;
            let couponSource: CouponSource = null;
            let discountAmount = 0;

            if (couponRef) {
                if (!cSnap || !cSnap.exists) {
                    throw new Error("COUPON_INVALID");
                }
                const cData = cSnap.data()!;
                const now = new Date();
                const validUntil = cData.valid_until ? new Date(cData.valid_until) : null;
                const isExpired = validUntil && validUntil < now;
                const maxUses = cData.max_uses ?? cData.usage_limit ?? null;
                const isExhausted = maxUses !== null && (cData.usage_count || 0) >= maxUses;
                const isCourseMatch = cData.course_id === "all" || !cData.course_id || cData.course_id === courseId;

                // Platform coupon (admin/marketing: no instructor_id, "admin" or is_admin) works on any course;
                // an instructor coupon only on that instructor's own courses.
                const source = couponSourceOf(cData);
                // Instructor coupons are a plan feature: valid only while the course instructor's
                // effective plan includes `coupons` (expired/downgraded plans disable them at use time).
                const isInstructorMatch =
                    source === "platform" ||
                    (!!instructorId && cData.instructor_id === instructorId && eff.plan.access.coupons === true);

                const discountPercent = Number(cData.discount_percent);
                const isDiscountValid = !isNaN(discountPercent) && discountPercent >= 0 && discountPercent <= 100;
                const isActive = cData.active !== false && cData.is_active !== false;

                if (isExpired || isExhausted || !isCourseMatch || !isInstructorMatch || !isDiscountValid || !isActive) {
                    throw new Error("COUPON_INVALID");
                }
                appliedCoupon = { id: cSnap.id, ...cData };
                couponSource = source;
                discountAmount = (coursePrice * discountPercent) / 100;
            }

            // The ONE split of this sale
            let split = computeSaleSplit({
                listPrice: coursePrice,
                discountAmount,
                couponSource,
                commissionRate: eff.commissionRate,
            });
            if (!instructorPrivateRef) {
                // No instructor to pay: the platform keeps everything the student paid
                split = {
                    ...split,
                    commissionRate: 1,
                    grossCommission: split.paidAmount,
                    instructorShare: 0,
                    platformNet: split.paidAmount,
                    platformCouponCost: 0,
                };
            }
            const couponCodeUsed: string | null = appliedCoupon?.code || null;
            const sale = saleFields({ planId, split, couponCode: couponCodeUsed, couponSource });
            const finalPrice = split.paidAmount;
            const nowIso = new Date().toISOString();

            if (finalPrice > 0) {
                if (currentBalance < finalPrice) {
                    throw new Error(`INSUFFICIENT_BALANCE:${finalPrice}:${currentBalance}`);
                }
                // Deduct from student's private profile
                t.set(studentPrivateRef, {
                    wallet_balance: Math.round((currentBalance - finalPrice) * 100) / 100,
                    updated_at: nowIso,
                }, { merge: true });
            }

            // Credit the instructor with exactly the instructor share of this sale
            // (a platform coupon can make this > 0 even when the student paid 0)
            if (instructorPrivateRef && split.instructorShare > 0) {
                t.set(instructorPrivateRef, {
                    wallet_balance: FieldValue.increment(split.instructorShare),
                    updated_at: nowIso,
                }, { merge: true });
            }

            const movedMoney = finalPrice > 0 || split.instructorShare > 0;
            if (movedMoney) {
                // Audit log of the sale
                t.create(txLogRef, {
                    type: "enrollment_payout",
                    payment_method: "wallet",
                    amount: split.paidAmount,
                    instructor_id: instructorId || null,
                    instructor_share: split.instructorShare,
                    platform_commission: split.platformNet,
                    commission_rate: split.commissionRate,
                    ...sale,
                    enrollment_id: enrollmentId,
                    student_id: user.uid,
                    student_name: studentData.full_name || user.email,
                    course_id: courseId,
                    course_title: course.title,
                    coupon_used: couponCodeUsed,
                    status: "completed",
                    created_at: nowIso,
                });
            }

            // Create enrollment
            t.set(enrollmentRef, {
                id: enrollmentId,
                student_id: user.uid,
                student_name: studentData.full_name || user.email,
                student_unique_id: studentPrivateData.student_id || studentData.student_id || "N/A",
                course_id: courseId,
                course_title: course.title,
                instructor_id: instructorId,
                instructor_name: course.instructor_name || "",
                enrolled_at: nowIso,
                progress: 0,
                status: "active",
                paid_amount: split.paidAmount,
                original_price: split.listPrice,
                coupon_used: couponCodeUsed,
                commission_rate: split.commissionRate,
                platform_commission: split.platformNet,
                instructor_share: split.instructorShare,
                ...sale,
                ...(movedMoney ? { transaction_id: txLogRef.id } : {}),
            });

            // Increment coupon usage inside transaction
            if (appliedCoupon && couponRef) {
                t.update(couponRef, { usage_count: FieldValue.increment(1) });
            }

            // Increment students_count
            t.update(courseRef, { students_count: FieldValue.increment(1), total_sales: FieldValue.increment(1) });

            return { finalPrice, appliedCoupon, couponSource, planId, split, movedMoney };
        });

        const { split, planId, couponSource } = result;
        const planName = PLANS[planId].name;
        const couponCodeUsed: string | null = result.appliedCoupon?.code || null;
        const couponLabel = couponCodeUsed
            ? ` (كوبون ${couponSource === "platform" ? "المنصة" : "المدرس"}: ${couponCodeUsed}، خصم ${split.discountAmount} ج.م)`
            : "";

        // 1. Log student course purchase
        const studentName = user.profile?.full_name || user.email || "طالب";
        const instructorName = course.instructor_name || "محاضر";

        await logServerActivity({
            action: "course_enrolled",
            category: result.finalPrice > 0 ? "financial" : "course",
            title: result.finalPrice > 0 ? `شراء كورس (${course.title})` : `اشتراك مجاني (${course.title})`,
            description: `اشترك الطالب "${studentName}" في كورس "${course.title}" للمدرس "${instructorName}" بقيمة ${result.finalPrice} ج.م${split.listPrice !== result.finalPrice ? ` بدلاً من ${split.listPrice} ج.م` : ""}${couponLabel}`,
            status: "success",
            user_id: user.uid,
            user_name: studentName,
            user_email: user.email,
            user_role: "student",
            amount: result.finalPrice,
            metadata: {
                course_id: courseId,
                course_title: course.title,
                instructor_id: instructorId,
                instructor_name: instructorName,
                paid_amount: result.finalPrice,
                original_price: split.listPrice,
                discount: split.discountAmount,
                coupon_used: couponCodeUsed,
                coupon_source: couponCodeUsed ? couponSource : null,
            },
        });

        // 2. Log instructor payout when the instructor earned something
        if (instructorId && split.instructorShare > 0) {
            const ratePct = formatRate(split.commissionRate);
            const base = couponSource === "platform" ? split.listPrice : split.paidAmount;
            const couponNote = couponCodeUsed
                ? couponSource === "platform"
                    ? ` كوبون المنصة "${couponCodeUsed}" (خصم ${split.discountAmount} ج.م) تتحمله المنصة، والمدرس يُحاسب على السعر الكامل ${split.listPrice} ج.م. صافي المنصة: ${split.platformNet} ج.م.`
                    : ` كوبون المدرس "${couponCodeUsed}" (خصم ${split.discountAmount} ج.م)، والعمولة على السعر بعد الخصم.`
                : "";

            await logServerActivity({
                action: "instructor_payout",
                category: "financial",
                title: `تحويل أرباح لمحفظة المدرس (${instructorName})`,
                description: `تم تحويل ${split.instructorShare} ج.م لمحفظة المدرس "${instructorName}" نظير اشتراك الطالب "${studentName}" في كورس "${course.title}". باقة "${planName}": عمولة المنصة ${ratePct} من ${base} ج.م = ${split.grossCommission} ج.م. المدفوع من الطالب: ${split.paidAmount} ج.م.${couponNote}`,
                status: "success",
                user_id: instructorId,
                user_name: instructorName,
                user_role: "instructor",
                target_user_id: user.uid,
                target_user_name: studentName,
                amount: split.instructorShare,
                metadata: {
                    course_id: courseId,
                    course_title: course.title,
                    student_id: user.uid,
                    student_name: studentName,
                    enrollment_id: enrollmentId,
                    sale_plan_id: planId,
                    sale_commission_rate: split.commissionRate,
                    sale_list_price: split.listPrice,
                    sale_discount: split.discountAmount,
                    sale_paid: split.paidAmount,
                    sale_gross_commission: split.grossCommission,
                    sale_instructor_share: split.instructorShare,
                    sale_platform_net: split.platformNet,
                    sale_platform_coupon_cost: split.platformCouponCost,
                    coupon_code: couponCodeUsed,
                    coupon_source: couponCodeUsed ? couponSource : null,
                },
            });
        }

        return NextResponse.json({ success: true, enrollmentId, paidAmount: result.finalPrice });
    } catch (err: any) {
        await logRouteFailure(request, {
            action: "course_enroll_failed",
            category: "financial",
            title: "فشل الاشتراك في كورس",
            description: `تعذر اشتراك المستخدم في الكورس ${logCourseId || "(غير محدد)"}${logCoupon ? ` (كوبون: ${logCoupon})` : ""}`,
            error: err,
            metadata: { course_id: logCourseId, coupon_code: logCoupon },
        });
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
        if (err.message === "STUDENT_NOT_FOUND" || err.message === "COUPON_NOT_FOUND" || err.message === "INSTRUCTOR_NOT_FOUND") {
            return NextResponse.json({ error: "خطأ في البيانات، تواصل مع الدعم" }, { status: 400 });
        }
        console.error("Course enroll error:", err);
        return NextResponse.json({ error: "فشل الاشتراك في الكورس" }, { status: 500 });
    }
}
