import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { createFawaterakTransaction } from "@/lib/payments/fawaterak";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { amount, idToken } = body;

        const chargeAmount = Number(amount);
        if (!chargeAmount || chargeAmount < 10) {
            return NextResponse.json(
                { error: "الحد الأدنى للشحن عبر فواتيرك هو 10 ج.م" },
                { status: 400 }
            );
        }

        // 1. Authenticate user via idToken or session cookie
        let uid = "";
        let userEmail = "";
        let displayName = "";

        if (idToken) {
            try {
                const decoded = await adminAuth.verifyIdToken(idToken);
                uid = decoded.uid;
                userEmail = decoded.email || "";
                displayName = decoded.name || "";
            } catch (tokenErr) {
                console.error("Token verification failed:", tokenErr);
            }
        }

        if (!uid) {
            const cookieStore = await cookies();
            const session = cookieStore.get("session")?.value;
            if (session) {
                try {
                    const decoded = await adminAuth.verifySessionCookie(session);
                    uid = decoded.uid;
                    userEmail = decoded.email || "";
                    displayName = decoded.name || "";
                } catch (sessErr) {
                    console.error("Session verification failed:", sessErr);
                }
            }
        }

        if (!uid) {
            return NextResponse.json(
                { error: "يرجى تسجيل الدخول أولاً لإتمام عملية الشحن" },
                { status: 401 }
            );
        }

        // Rate limit: 10 initiate requests per 2 minutes per user
        if (!checkRateLimit(`pay_init_${uid}`, 10, 120000)) {
            return NextResponse.json(
                { error: "تم تجاوز الحد الأقصى للمحاولات، يرجى الانتظار قليلاً" },
                { status: 429 }
            );
        }
        const profileSnap = await adminDb.collection("profiles").doc(uid).get();
        const profileData = profileSnap.exists ? profileSnap.data() : {};

        const fullName = profileData?.full_name || displayName || "طالب المنارة";
        const [firstName, ...restName] = fullName.trim().split(" ");
        const lastName = restName.join(" ") || "المحترم";
        const email = profileData?.email || userEmail || `student_${uid}@manara.academy`;
        const phone = profileData?.phone_number || profileData?.phone || "01000000000";

        // 3. Determine base URL
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "manara-academy.vercel.app";
        const proto = request.headers.get("x-forwarded-proto") || "https";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

        // 4. Create transaction on Fawaterak
        const sessionResult = await createFawaterakTransaction({
            amount: chargeAmount,
            customer: {
                firstName,
                lastName,
                email,
                phone,
                uniqueId: profileData?.student_id || uid,
            },
            studentId: uid,
            baseUrl,
        });

        // 5. Store pending payment record in Firestore
        await adminDb.collection("wallet_requests").add({
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
