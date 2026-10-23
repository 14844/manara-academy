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
        const { amount } = body;

        const chargeAmount = Number(amount);
        if (!chargeAmount || isNaN(chargeAmount) || chargeAmount < 10) {
            return NextResponse.json(
                { error: "الحد الأدنى للشحن عبر فواتيرك هو 10 ج.م" },
                { status: 400 }
            );
        }

        if (chargeAmount > 50000) {
            return NextResponse.json(
                { error: "الحد الأقصى للشحن في العملية الواحدة هو 50,000 ج.م" },
                { status: 400 }
            );
        }

        // 1. Authenticate via session cookie only (checkRevoked + account status enforced centrally)
        const authUser = await getActiveServerAuth(request);
        const uid = authUser?.uid || "";
        const userEmail = authUser?.email || "";
        const displayName = authUser?.profile?.full_name || "";

        if (!uid) {
            return NextResponse.json(
                { error: "يرجى تسجيل الدخول أولاً لإتمام عملية الشحن" },
                { status: 401 }
            );
        }

        // 2. Strict Rate Limiting: 5 initiate requests per 2 minutes per user
        if (!(await checkRateLimitAsync(`pay_init_${uid}`, 5, 120)).success) {
            return NextResponse.json(
                { error: "تم تجاوز الحد الأقصى للمحاولات، يرجى الانتظار دقيقتين قبل المحاولة مرة أخرى" },
                { status: 429 }
            );
        }

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

        // 3. Determine base URL
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "manara-academy.vercel.app";
        const proto = request.headers.get("x-forwarded-proto") || "https";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

        // 4. Create transaction on Fawaterak API v3
        const sessionResult = await createFawaterakTransaction({
            amount: chargeAmount,
            customer: {
                firstName: firstName.trim().substring(0, 50),
                lastName: lastName.trim().substring(0, 50),
                email: email.trim(),
                phone: phone.trim(),
                uniqueId: profileData?.student_id || uid,
            },
            studentId: uid,
            baseUrl,
        });

        // 5. Store pending payment record in Firestore (source of truth for payment verification)
        const walletRequestRef = await adminDb.collection("wallet_requests").add({
            student_id: uid,
            student_name: fullName,
            student_email: email,
            student_unique_id: profileData?.student_id || "N/A",
            amount: chargeAmount,
            sender_number: "فواتيرك (دفع إلكتروني فوري)",
            payment_gateway: "fawaterak",
            fawaterak_intent_key: sessionResult.intentKey,
            status: "pending_payment",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        // 6. Log server activity
        await logServerActivity({
            action: "fawaterak_payment_initiated",
            category: "financial",
            title: "بدء عملية دفع إلكتروني (فواتيرك)",
            description: `قام الطالب ${fullName} ببدء معاملة دفع بقيمة ${chargeAmount} ج.م عبر فواتيرك`,
            status: "pending",
            user_id: uid,
            user_name: fullName,
            user_email: email,
            user_role: "student",
            amount: chargeAmount,
            metadata: {
                intent_key: sessionResult.intentKey,
                wallet_request_id: walletRequestRef.id,
            },
        });

        return NextResponse.json({
            status: "success",
            paymentUrl: sessionResult.paymentUrl,
            intentKey: sessionResult.intentKey,
        });
    } catch (error: any) {
        console.error("Fawaterak initiate error:", error);
        return NextResponse.json(
            { error: error.message || "حدث خطأ أثناء التواصل مع بوابة فواتيرك" },
            { status: 500 }
        );
    }
}
