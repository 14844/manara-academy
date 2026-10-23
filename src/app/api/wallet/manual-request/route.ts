import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { checkRateLimitAsync } from "@/lib/rate-limiter";
import { extractStoragePath } from "@/lib/media-security";
import { SUPABASE_BUCKET } from "@/lib/supabase/admin";

/**
 * Accept only a receipt uploaded by THIS user into this project's own storage
 * (payment_proofs/proof_<uid>_...). Returns a normalized platform URL or null.
 */
function normalizeReceiptUrl(urlStr: unknown, uid: string): string | null {
    if (!urlStr || typeof urlStr !== "string" || urlStr.length > 2048) return null;
    const path = extractStoragePath(urlStr, SUPABASE_BUCKET);
    if (!path || !path.startsWith(`payment_proofs/proof_${uid}_`) || path.includes("/", "payment_proofs/".length)) {
        return null;
    }
    return `/api/storage/sign?url=${encodeURIComponent(path)}`;
}

export async function POST(request: Request) {
    try {
        const user = await getActiveServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 });
        }

        if (!(await checkRateLimitAsync(`wallet_req_${user.uid}`, 5, 60)).success) {
            return NextResponse.json({ error: "تم إرسال عدة طلبات مؤخراً، يرجى الانتظار دقيقة والمحاولة مجدداً" }, { status: 429 });
        }

        const body = await request.json();
        const { amount, senderNumber, screenshotUrl } = body;

        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 50000) {
            return NextResponse.json({ error: "المبلغ المدخل غير صالح (الحد الأقصى 50,000 ج.م)" }, { status: 400 });
        }

        if (!senderNumber || typeof senderNumber !== "string" || senderNumber.length > 30 || !screenshotUrl) {
            return NextResponse.json({ error: "بيانات التحويل وصورة الإيصال مطلوبة" }, { status: 400 });
        }

        const receiptUrl = normalizeReceiptUrl(screenshotUrl, user.uid);
        if (!receiptUrl) {
            return NextResponse.json({ error: "رابط صورة الإيصال غير صالح (يجب أن يكون مرفوعاً عبر المنصة)" }, { status: 400 });
        }

        const profileSnap = await adminDb.collection("profiles").doc(user.uid).get();
        const profile = profileSnap.exists ? profileSnap.data() : null;

        const docRef = await adminDb.collection("wallet_requests").add({
            student_id: user.uid,
            student_name: profile?.full_name || user.email,
            student_email: user.email,
            student_unique_id: profile?.student_id || "N/A",
            amount: numAmount,
            sender_number: senderNumber,
            screenshot_url: receiptUrl,
            payment_gateway: "manual",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        await logServerActivity({
            action: "wallet_recharge_manual_request",
            category: "financial",
            title: "طلب شحن محفظة (يدوي)",
            description: `قام الطالب بتقديم طلب شحن محفظة بقيمة ${numAmount} ج.م من رقم (${senderNumber}) بانتظار مراجعة الإدارة`,
            status: "pending",
            user_id: user.uid,
            user_name: profile?.full_name || user.email || "طالب",
            user_email: user.email || "",
            user_role: "student",
            amount: numAmount,
            metadata: {
                request_id: docRef.id,
                sender_number: senderNumber,
            },
        });

        return NextResponse.json({ success: true, requestId: docRef.id });
    } catch (err: any) {
        console.error("Manual wallet request error:", err);
        return NextResponse.json({ error: "حدث خطأ أثناء إرسال طلب الشحن" }, { status: 500 });
    }
}
