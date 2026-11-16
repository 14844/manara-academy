import { NextResponse } from "next/server";
import { logRouteFailure } from "@/lib/server-auth";

/**
 * POST /api/admin/payments/refund — RETIRED (410 Gone).
 * This endpoint refunded `course_orders`, which were only created by the removed Fawaterak gateway.
 * Enrollments are now paid from the wallet; nothing creates course_orders anymore, so the route is
 * disabled and every call is logged.
 */
export async function POST(request: Request) {
    let orderId = "";
    try {
        const body = await request.clone().json().catch(() => ({}));
        orderId = typeof body?.orderId === "string" ? body.orderId.slice(0, 128) : "";
    } catch {
        orderId = "";
    }

    await logRouteFailure(request, {
        action: "admin_course_refund_failed",
        category: "financial",
        title: "محاولة استخدام مسار استرداد ملغى",
        description: `محاولة استدعاء مسار الاسترداد القديم (طلبات بوابة الدفع المحذوفة)${orderId ? ` للطلب ${orderId}` : ""}`,
        metadata: { order_id: orderId || null, endpoint: "/api/admin/payments/refund", reason: "endpoint_retired" },
    });

    return NextResponse.json(
        { error: "تم إيقاف خدمة الاسترداد هذه نهائياً لأنها كانت مرتبطة ببوابة الدفع القديمة التي تم حذفها. لا يمكن تنفيذ أي عملية استرداد من هنا." },
        { status: 410 }
    );
}
