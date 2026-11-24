import { NextResponse } from "next/server"
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limiter"

/**
 * Support chatbot.
 *   widget -> POST /api/ai/support -> n8n webhook (AI Agent + Gemini, memory by session, courses tool) -> reply
 * The n8n URL + shared secret live in server env only (N8N_CHAT_WEBHOOK_URL, N8N_CHAT_SECRET);
 * the Gemini key lives in n8n only. If n8n is not configured, down, slow, or over its quota,
 * we answer from the built-in KNOWLEDGE_BASE below (the old canned replies) — the user never sees an error.
 */

const N8N_TIMEOUT_MS = 25_000

const KNOWLEDGE_BASE = [
    {
        keywords: ["تسجيل", "انشاء حساب", "حساب جديد", "سجل", "انضمام", "عمل اكونت"],
        answer: `✨ **طريقة إنشاء حساب جديد في أكاديمية المنارة:**
1. اضغط على زر **"إنشاء حساب"** من أعلى الصفحة الرئيسية.
2. اختر نوع الحساب: **حساب طالب** أو **حساب معلم**.
3. املأ البيانات الأساسية (الاسم، البريد الإلكتروني، رقم الهاتف، والمرحلة الدراسية للطلاب).
4. بعد التسجيل تقدر تدخل **المعامل الافتراضية** على طول، وباقي المنصة بيتفعّل بعد مراجعة الإدارة لحسابك.`
    },
    {
        keywords: ["دفع", "فودافون كاش", "شحن", "محفظة", "رصيد", "طرق الدفع", "فلوس", "انستا باي", "فوري"],
        answer: `💳 **طرق الدفع وشحن المحفظة المتاحة:**
* **فودافون كاش / إنستاباي:** عبر التحويل لرقم المنصة ورفع صورة الإيصال من صفحة المحفظة ليتم تأكيده من الإدارة.
* **رصيد المحفظة المباشر:** يمكنك شحن محفظتك بداخل المنصة والشراء منها بضغطة زر واحدة.
* **كوبونات الخصم:** إذا كان لديك كود خصم من معلمك، اكتبه في خانة الكوبون عند الشراء للاستفادة من الخصم الفوري.`
    },
    {
        keywords: ["استرجاع", "استرداد", "رجع", "سياسة الاسترجاع", "الغاء الكورس"],
        answer: `🔄 **استرداد الأموال:**
* لأي طلب استرداد تواصل مع **الدعم الفني عبر واتساب** وهيتم مراجعة طلبك.
* تقدر تقرأ السياسة كاملة في صفحة **سياسة الاسترجاع** أسفل الموقع.`
    },
    {
        keywords: ["مختبر", "مختبرات", "معمل", "معامل", "كيمياء", "فيزياء", "تفاعل", "دوائر", "فضاء", "كواكب"],
        answer: `🧪 **المعامل الافتراضية ثلاثية الأبعاد بأكاديمية المنارة:**
* **الفيزياء:** الدوائر الكهربائية وقانون أوم.
* **الكيمياء:** التفاعلات الكيميائية وموازنة المعادلات وبناء الجزيئات.
* **الرياضيات:** رسم الدوال والتحويلات والتفاضل.
* **الفضاء:** المجموعة الشمسية والكواكب.
* المعامل مجانية للطلاب — ادخل من قسم **"المختبرات الافتراضية"** في القائمة العلوية!`
    },
    {
        keywords: ["تقرير", "ولي الامر", "تقارير", "درجات", "متابعة", "رابط التقرير"],
        answer: `📊 **تقارير أولياء الأمور:**
* المعلم بيعمل تقرير متابعة فيه الحضور ودرجات الاختبارات ونقاط القوة والضعف.
* ولي الأمر بيوصله رابط مباشر يفتح من أي موبايل أو كمبيوتر من غير تسجيل دخول.`
    },
    {
        keywords: ["مدرس", "معلم", "نسبة", "عمولة", "ارباح", "سحب", "باقة", "باقات", "اشتراك"],
        answer: `👨‍🏫 **باقات المدرسين وعمولة المنصة:**
* **البداية (مجاناً):** عمولة 15%.
* **المحترف (499 ج/شهر):** عمولة 10% + كوبونات خصم + ظهور مميز.
* **النخبة (1499 ج/شهر):** عمولة 5% + كل مميزات المحترف + تقارير ولي الأمر تلقائي.
* المدرس يطلب سحب أرباحه من لوحة تحكم المعلم (قسم المسحوبات).`
    },
    {
        keywords: ["شهادة", "شهادات", "اتمام", "تخرج"],
        answer: `🎓 **الشهادات:**
* بعد إتمام كل محاضرات الكورس واجتياز الاختبارات، بيتم إصدار **شهادة إتمام** باسم الطالب تقدر تحمّلها PDF.`
    }
]

function cannedReply(message: string): { reply: string; matched: boolean } {
    const lowerMsg = message.toLowerCase()
    const matched = KNOWLEDGE_BASE.find(k => k.keywords.some(kw => lowerMsg.includes(kw.toLowerCase())))
    if (matched) return { reply: matched.answer, matched: true }
    if (["سلام", "مرحبا", "اهلا", "صباح", "مساء", "ازيك", "hi", "hello"].some(w => lowerMsg.includes(w))) {
        return {
            matched: false,
            reply: `أهلاً وسهلاً بك في أكاديمية المنارة التعليمية! 🌟\n\nأنا **آلي المنصة الذكي**، جاهز لمساعدتك في أي استفسار حول:\n• الكورسات والمحاضرات 📚\n• شحن الرصيد وطرق الدفع 💳\n• المختبرات الافتراضية 🧪\n• تقارير أولياء الأمور والشهادات 🎓\n\nتفضل بطرح سؤالك مباشرة!`,
        }
    }
    return {
        matched: false,
        reply: `شكراً لتواصلك مع آلي منصة المنارة! 🤖\n\nيمكنك استكشاف أقسام المنصة كالتالي:\n• **الكورسات:** تصفح قسم الكورسات للتسجيل في أحدث الشروحات.\n• **المختبرات:** قسم المختبرات الافتراضية يوفر تجارب تفاعلية في الكيمياء والفيزياء والرياضيات والفضاء.\n• **الدعم البشري:** لو عندك استفسار عن حسابك أو مشكلة تقنية، اضغط **"واتساب الدعم الفني"** وفريق الدعم هيرد عليك.`,
    }
}

/** Ask the n8n AI agent. Returns null on any failure (not configured, down, timeout, quota, bad response). */
async function askN8n(payload: Record<string, unknown>): Promise<string | null> {
    const url = process.env.N8N_CHAT_WEBHOOK_URL
    const secret = process.env.N8N_CHAT_SECRET
    if (!url || !secret) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-manara-bot-key": secret },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: "no-store",
        })
        if (!res.ok) {
            console.warn("n8n chat: HTTP", res.status)
            return null
        }
        const data: any = await res.json().catch(() => null)
        const item = Array.isArray(data) ? data[0] : data
        const reply = item?.reply ?? item?.output ?? item?.text
        if (typeof reply !== "string" || !reply.trim()) return null
        return reply.trim().slice(0, 4000)
    } catch (e: any) {
        console.warn("n8n chat failed:", e?.name === "AbortError" ? "timeout" : e?.message)
        return null
    } finally {
        clearTimeout(timer)
    }
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    if (!(await checkRateLimitAsync(`ai_${ip}`, 20, 60)).success) {
        return NextResponse.json({ reply: "لقد أرسلت عدة رسائل بسرعة. يرجى الانتظار دقيقة والمحاولة مجدداً.", source: "limit" }, { status: 429 });
    }

    try {
        // Size caps: reject oversized bodies, keep only a bounded plain-text message
        const contentLength = Number(request.headers.get("content-length") || 0)
        if (contentLength > 8 * 1024) {
            return NextResponse.json({ reply: "الرسالة طويلة جداً." }, { status: 413 })
        }
        const raw = await request.text()
        if (raw.length > 8 * 1024) {
            return NextResponse.json({ reply: "الرسالة طويلة جداً." }, { status: 413 })
        }
        let body: any = {}
        try { body = JSON.parse(raw) } catch { body = {} }
        const message: string = (typeof body?.message === "string" ? body.message : "")
            .replace(/[<>]/g, "")
            .trim()
            .slice(0, 500)
        const rawSession = typeof body?.session_id === "string" ? body.session_id : ""
        const sessionId = /^[A-Za-z0-9_-]{8,64}$/.test(rawSession) ? rawSession : null

        if (!message) {
            return NextResponse.json({ reply: "مرحباً بك! كيف يمكنني مساعدتك في أكاديمية المنارة اليوم؟ 😊" })
        }

        const { getServerAuth } = await import("@/lib/server-auth")
        const user = await getServerAuth(request).catch(() => null)
        const userName = user?.profile?.full_name || user?.email || "زائر للمنصة"

        // AI path — protect the free Gemini quota with an extra daily cap per user/IP.
        let reply: string | null = null
        let source: "ai" | "fallback" = "fallback"
        const daily = await checkRateLimitAsync(`ai_day_${user?.uid || ip}`, 150, 24 * 60 * 60)
        if (daily.success && sessionId) {
            reply = await askN8n({
                message,
                // Memory key: scoped to the account when logged in so sessions can't be mixed up
                session_id: user ? `u_${user.uid}_${sessionId}` : `g_${sessionId}`,
                user: {
                    first_name: String(user?.profile?.full_name || "").split(" ")[0] || null,
                    role: user?.role || "guest",
                },
            })
            if (reply) source = "ai"
        }

        let matched = false
        if (!reply) {
            const canned = cannedReply(message)
            reply = canned.reply
            matched = canned.matched
        }

        // Log the interaction
        try {
            const { logServerActivity } = await import("@/lib/server-activity-logger")
            await logServerActivity({
                action: "ai_chat_query",
                category: "ai_support",
                title: `محادثة ${source === "ai" ? "ذكاء اصطناعي" : "رد جاهز"}: ${message.slice(0, 45)}${message.length > 45 ? '...' : ''}`,
                description: `سؤال المستخدم "${userName}": "${message}"\n\nرد الآلي: "${reply.slice(0, 150)}..."`,
                status: "info",
                user_id: user?.uid || "guest",
                user_name: userName,
                user_email: user?.email || "",
                user_role: (user?.role as any) || "guest",
                metadata: {
                    user_message: message,
                    ai_reply: reply.slice(0, 300),
                    source,
                    matched_kb: matched,
                    ip,
                },
            })
        } catch (logErr) {
            console.warn("Failed to log AI activity:", logErr)
        }

        return NextResponse.json({ reply, source })
    } catch (error) {
        console.error("AI support error:", error)
        return NextResponse.json({
            reply: "مرحباً بك! أنا آلي الدعم الذكي لأكاديمية المنارة. كيف يمكنني مساعدتك؟",
            source: "fallback",
        })
    }
}
