import { NextResponse } from "next/server";

export async function POST(request: Request) {
    // Locked endpoint: Electronic payments are disabled until further notice
    return NextResponse.json({
        error: "بوابة الدفع الإلكتروني مغلقة مؤقتاً للتحديثات وستفتح قريباً. يرجى استخدام طريقة التحويل اليدوي (فودافون كاش / إنستاباي) لشحن رصيدك فوراً."
    }, { status: 403 });
}
