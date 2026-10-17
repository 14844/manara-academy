"use client"

import { MessageCircle, Phone, X, Bot, Send, Sparkles, User, ArrowRight, Loader2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_SUPPORT } from "@/lib/support-settings"
import { useSupportSettings } from "@/hooks/use-support-settings"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    text: string
    time: string
}

const QUICK_SUGGESTIONS = [
    "طرق شحن المحفظة والدفع 💳",
    "المختبرات الافتراضية 🧪",
    "نسبة عمولة المدرسين 👨‍🏫",
    "سياسة استرداد الأموال 🔄",
    "تقارير أولياء الأمور 📊"
]

export function SupportButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<"menu" | "ai-chat">("menu")
    const { settings: contacts } = useSupportSettings()

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            text: "أهلاً بك في أكاديمية المنارة! 🌟 أنا آلي المنصة الذكي، جاهز للإجابة الفورية على كافة استفساراتك.",
            time: "الآن"
        }
    ])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (activeTab === "ai-chat") {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isTyping, activeTab])

    const whatsappLink = `https://wa.me/${contacts.phone}`
    const supportEmail = contacts.email

    const handleSendMessage = async (textToSend?: string) => {
        const query = (textToSend || inputValue).trim()
        if (!query || isTyping) return

        const userMsg: ChatMessage = {
            id: String(Date.now()),
            role: "user",
            text: query,
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        }

        setMessages(prev => [...prev, userMsg])
        setInputValue("")
        setIsTyping(true)

        try {
            const res = await fetch("/api/ai/support", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: query })
            })

            const data = await res.json()
            const replyMsg: ChatMessage = {
                id: String(Date.now() + 1),
                role: "assistant",
                text: data.reply || "عذراً، حدث خطأ بسيط. تفضل بمراسلتنا عبر واتساب للمساعدة الفورية.",
                time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
            }
            setMessages(prev => [...prev, replyMsg])
        } catch (error) {
            console.error("AI error:", error)
            setMessages(prev => [
                ...prev,
                {
                    id: String(Date.now() + 1),
                    role: "assistant",
                    text: "عذراً، لم أتمكن من الاتصال بالخادم الآن. يمكنك التواصل مباشرة عبر واتساب الدعم الفني.",
                    time: "الآن"
                }
            ])
        } finally {
            setIsTyping(false)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 font-arabic">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform bg-primary text-primary-foreground border-4 border-background relative"
                    >
                        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-background"></span>
                        </span>
                    </Button>
                </PopoverTrigger>

                <PopoverContent
                    side="top"
                    align="end"
                    className={`p-0 overflow-hidden border-2 mb-2 font-arabic transition-all duration-300 shadow-2xl ${
                        activeTab === "ai-chat" ? "w-[360px] md:w-[400px] h-[520px]" : "w-80"
                    }`}
                    sideOffset={10}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-l from-primary via-primary/90 to-primary/80 p-4 text-primary-foreground flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            {activeTab === "ai-chat" && (
                                <button
                                    onClick={() => setActiveTab("menu")}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
                                    title="رجوع للقائمة"
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            )}
                            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center font-bold">
                                {activeTab === "ai-chat" ? <Bot className="h-5 w-5 text-emerald-300" /> : <Sparkles className="h-5 w-5 text-amber-300" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">
                                    {activeTab === "ai-chat" ? "آلي منصة المنارة الذكي 🤖" : "مركز المساعدة والدعم"}
                                </h3>
                                <p className="text-[10px] opacity-90">
                                    {activeTab === "ai-chat" ? "مساعد فوري متاح 24/7" : "فريق الدعم والرد الفوري"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Menu View */}
                    {activeTab === "menu" && (
                        <div className="p-4 space-y-3 bg-background">
                            {/* AI Chat Option */}
                            <button
                                onClick={() => setActiveTab("ai-chat")}
                                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all group text-right shadow-sm"
                            >
                                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold group-hover:scale-110 transition-transform shadow-md shadow-primary/20">
                                    <Bot className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-bold text-foreground">تواصل مع آلي المنصة</p>
                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded-md">
                                            فوري AI
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">رد فوري وذكي على كل استفساراتك</p>
                                </div>
                            </button>

                            {/* WhatsApp Option */}
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted transition-colors group text-right"
                            >
                                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-green-500 text-white font-bold group-hover:scale-110 transition-transform shadow-md shadow-green-500/20">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-foreground">واتساب الدعم الفني</p>
                                    <p className="text-[10px] text-muted-foreground">{contacts.phone || "فريق الدعم المباشر"}</p>
                                </div>
                            </a>

                            {/* Gmail Option */}
                            <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${supportEmail}`}
                                target="_blank"
                                className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted transition-colors group text-right"
                            >
                                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-foreground group-hover:scale-110 transition-transform border">
                                    <MessageCircle className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-foreground">مراسلتنا عبر البريد</p>
                                    <p className="text-[10px] text-muted-foreground italic">Gmail</p>
                                </div>
                            </a>

                            <p className="text-[10px] text-center text-muted-foreground pt-1">
                                الدعم الآلي متاح دائماً • الدعم البشري ٩ ص - ٩ م
                            </p>
                        </div>
                    )}

                    {/* AI Chat View */}
                    {activeTab === "ai-chat" && (
                        <div className="flex flex-col h-[448px] bg-muted/10">
                            {/* Messages List */}
                            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar text-xs">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                                    >
                                        <div
                                            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                                msg.role === "user"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-emerald-600 text-white shadow-sm"
                                            }`}
                                        >
                                            {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                                        </div>
                                        <div
                                            className={`p-3 rounded-2xl max-w-[82%] leading-relaxed whitespace-pre-wrap ${
                                                msg.role === "user"
                                                    ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                                                    : "bg-background border rounded-tl-none shadow-sm text-foreground"
                                            }`}
                                        >
                                            {msg.text}
                                            <div
                                                className={`text-[9px] mt-1 opacity-60 text-left ${
                                                    msg.role === "user" ? "text-primary-foreground" : "text-muted-foreground"
                                                }`}
                                            >
                                                {msg.time}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isTyping && (
                                    <div className="flex gap-2 items-center text-muted-foreground text-xs p-2">
                                        <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                            <Bot className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-background border px-3 py-1.5 rounded-full shadow-sm">
                                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                            <span>الآلي يكتب الرد...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Quick Suggestions Chips */}
                            <div className="p-2 border-t bg-background/50 flex gap-1.5 overflow-x-auto whitespace-nowrap">
                                {QUICK_SUGGESTIONS.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSendMessage(q)}
                                        className="text-[10px] bg-background border hover:border-primary/50 hover:bg-primary/5 px-2.5 py-1 rounded-full text-foreground transition-all shrink-0 font-medium"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>

                            {/* Input Area */}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    handleSendMessage()
                                }}
                                className="p-2.5 border-t bg-background flex items-center gap-2"
                            >
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="اكتب استفسارك هنا..."
                                    className="text-xs h-9 bg-muted/30 focus-visible:ring-1"
                                    disabled={isTyping}
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-9 px-3 gap-1 shrink-0 font-bold"
                                    disabled={!inputValue.trim() || isTyping}
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </Button>
                            </form>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    )
}
