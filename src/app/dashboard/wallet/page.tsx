"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Wallet,
    PlusCircle,
    History,
    Smartphone,
    CloudUpload,
    Loader2,
    CheckCircle2,
    Clock,
    XCircle,
    Copy,
    AlertCircle,
    CreditCard,
    Zap,
    ShieldCheck,
    ArrowRight,
    Lock
} from "lucide-react"
import { toast } from "sonner"
import { logActivity } from "@/lib/activity-logger"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function WalletContent() {
    const searchParams = useSearchParams()
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [history, setHistory] = useState<any[]>([])

    // Manual transfer form state
    const [amount, setAmount] = useState("")
    const [senderNumber, setSenderNumber] = useState("")
    const [file, setFile] = useState<File | null>(null)

    // URL Status Banner
    const fawaterakStatus = searchParams.get("fawaterak")

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                await fetchProfile(currentUser.uid)
                await fetchHistory(currentUser.uid)
            }
            setLoading(false)
        })
        return () => unsubscribe()
    }, [])

    async function fetchProfile(uid: string) {
        try {
            const res = await fetch("/api/profile/me")
            if (res.ok) {
                const data = await res.json()
                setProfile(data)
                return
            }
            const pDoc = await getDoc(doc(db, "profiles", uid))
            if (pDoc.exists()) setProfile(pDoc.data())
        } catch (e) {
            console.error("Profile fetch error:", e)
        }
    }

    async function fetchHistory(uid: string) {
        try {
            const q = query(
                collection(db, "wallet_requests"),
                where("student_id", "==", uid)
            )
            const snap = await getDocs(q)
            const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            // Sort in memory to avoid requiring a composite index
            const sortedDocs = docs.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )

            setHistory(sortedDocs)
        } catch (error) {
            console.error("History fetch error:", error)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    // Submit Manual Transfer Request (Vodafone Cash / InstaPay)
    const handleSubmitManualRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!amount || !senderNumber || !file) {
            toast.error("يرجى ملء جميع البيانات ورفع صورة التحويل")
            return
        }

        setSubmitting(true)
        try {
            // Upload screenshot to Supabase Storage via secure server API
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.uid}_${Date.now()}.${fileExt}`
            const folder = "payment_proofs"

            const uploadRes = await fetch(`/api/upload/supabase?fileName=${encodeURIComponent(fileName)}&folder=${encodeURIComponent(folder)}`, {
                method: 'POST',
                body: file,
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            })

            if (!uploadRes.ok) {
                const errText = await uploadRes.text()
                let errorMsg = "فشل رفع الصورة"
                try {
                    const errJson = JSON.parse(errText)
                    errorMsg = errJson.error || errorMsg
                } catch (e) {
                    errorMsg = `خطأ السيرفر: ${uploadRes.status}`
                }
                throw new Error(errorMsg)
            }

            const { url: publicUrl } = await uploadRes.json()

            // Create request via secure server route
            const manualRes = await fetch("/api/wallet/manual-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: Number(amount),
                    senderNumber,
                    screenshotUrl: publicUrl,
                }),
            })
            const manualData = await manualRes.json()
            if (!manualRes.ok) {
                throw new Error(manualData.error || "فشل إرسال طلب الشحن")
            }
            const reqRef = { id: manualData.requestId }

            toast.success("تم إرسال طلب الشحن بنجاح! سيتم مراجعته من قبل الإدارة خلال ساعات.")

            // Log activity
            logActivity({
                action: "wallet_recharge_manual_request",
                category: "financial",
                title: "طلب شحن محفظة (يدوي)",
                description: `قام الطالب بتقديم طلب شحن محفظة بقيمة ${amount} ج.م من رقم (${senderNumber}) بانتظار مراجعة الإدارة`,
                status: "pending",
                user_id: user.uid,
                user_name: profile?.full_name || user.displayName || "طالب",
                user_email: user.email || "",
                user_role: "student",
                amount: Number(amount),
                metadata: {
                    request_id: reqRef.id,
                    sender_number: senderNumber,
                    proof_url: publicUrl,
                }
            }).catch(() => {})

            // Clean up
            setAmount("")
            setSenderNumber("")
            setFile(null)
            fetchHistory(user.uid)
        } catch (error: any) {
            console.error("Wallet request error:", error)
            toast.error(error.message || "حدث خطأ أثناء إرسال الطلب")
        } finally {
            setSubmitting(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.info("تم نسخ الرقم: " + text)
    }

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500 max-w-6xl mx-auto p-4 md:p-0">
            <div>
                <h1 className="text-3xl font-black flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-primary" />
                    المحفظة الرقمية
                </h1>
                <p className="text-muted-foreground mt-1">بوابتك لإدارة رصيدك والتحكم الدقيق في عمليات الشراء والاشتراك في الكورسات</p>
            </div>

            {/* Notification Banners based on Fawaterak Redirect */}
            {fawaterakStatus === "success" && (
                <div className="bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-base">تم شحن المحفظة بنجاح عبر فواتيرك! 🎉</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">تمت إضافة الرصيد إلى محفظتك بنجاح وهو متاح الآن للاشتراك في أي كورس فوراً.</p>
                    </div>
                </div>
            )}

            {fawaterakStatus === "failed" && (
                <div className="bg-destructive/10 border-2 border-destructive/30 text-destructive p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
                    <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                        <XCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                        <h4 className="font-bold text-base">تعذر استكمال عملية الدفع الإلكتروني</h4>
                        <p className="text-xs opacity-90 mt-0.5">تم إلغاء عملية الدفع أو رفضها من قبل البنك. يمكنك المحاولة مجدداً أو استخدام التحويل اليدوي.</p>
                    </div>
                </div>
            )}

            {fawaterakStatus === "pending" && (
                <div className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                        <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-base">عملية الدفع قيد المعالجة (فوري / أمان)</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">إذا قمت بالدفع عبر كود فوري أو أمان، سيتم شحن رصيدك تلقائياً فور تأكيد السداد لدى المحل.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Balance & Recharge Methods */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Balance Card */}
                    <Card className="bg-gradient-to-br from-primary via-primary/95 to-indigo-900 text-primary-foreground border-none shadow-xl overflow-hidden relative">
                        <div className="absolute top-[-20px] right-[-20px] w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none"></div>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-medium opacity-90">الرصيد المتاح بالمحفظة</CardTitle>
                                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none gap-1 font-bold">
                                    <ShieldCheck className="h-3 w-3" />
                                    حساب موثق
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-8">
                            <div className="flex items-baseline gap-3">
                                <span className="text-5xl font-black tracking-tight">{profile?.wallet_balance?.toLocaleString() || 0}</span>
                                <span className="text-2xl font-bold opacity-80">ج.م</span>
                            </div>
                            <p className="text-xs opacity-75 mt-2">يمكنك استخدام هذا الرصيد للاشتراك في أي كورس فورياً بضغطة زر واحدة.</p>
                        </CardContent>
                    </Card>

                    {/* Recharge Options */}
                    <Card className="border-2 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <PlusCircle className="h-5 w-5 text-primary" />
                                شحن المحفظة (فودافون كاش / إنستاباي)
                            </CardTitle>
                            <CardDescription>قم بالتحويل اليدوي لأحد أرقامنا المعتمدة وسيقوم فريق الدعم بتأكيد الرصيد فوراً</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Direct Course Purchase Banner */}
                            <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                        <Zap className="h-4 w-4 text-emerald-600 fill-emerald-600" />
                                        تريد الدفع الفوري بالفيزا أو كروت ميزة أو فوري؟
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        يمكنك التوجه مباشرة لصفحة أي كورس والضغط على <strong className="text-foreground">"الاشتراك وشراء الكورس"</strong> وستتمكن من سداد قيمته فورياً بأمان دون الحاجة لشحن المحفظة مسبقاً!
                                    </p>
                                </div>
                                <Button size="sm" asChild className="shrink-0 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-md">
                                    <Link href="/courses">
                                        <span>تصفح الكورسات</span>
                                        <ArrowRight className="h-3.5 w-3.5 mr-auto" />
                                    </Link>
                                </Button>
                            </div>

                            {/* MANUAL TRANSFER FORM & NUMBERS */}
                            <div className="bg-muted/50 p-6 rounded-2xl space-y-6 border-2 border-dashed border-primary/20">
                                <div className="space-y-4">
                                    <h3 className="font-bold text-sm flex items-center gap-2 text-primary">
                                        <Smartphone className="h-4 w-4" />
                                        1. المحافظ الإلكترونية (Vodafone, Orange, Etisalat Cash)
                                    </h3>
                                            <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-primary/10">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-muted-foreground font-bold">رقم التحويل للمحافظ</p>
                                                    <p className="text-lg font-black tracking-widest text-primary">01068206660</p>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard("01068206660")} className="h-10 w-10 text-primary">
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 border-t pt-4">
                                            <h3 className="font-bold text-sm flex items-center gap-2 text-primary">
                                                <Smartphone className="h-4 w-4" />
                                                2. التحويل عبر إنستا باي (InstaPay)
                                            </h3>
                                            <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-primary/10">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-muted-foreground font-bold">رقم التحويل (إنستا باي)</p>
                                                    <p className="text-lg font-black tracking-widest text-primary">01122331600</p>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard("01122331600")} className="h-10 w-10 text-primary">
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                                <span className="text-primary font-bold">ملحوظة هامة:</span> بعد إتمام عملية التحويل، يرجى رفع "سكرين شوت" واضحة لعملية التحويل أدناه. ستقوم الإدارة بمراجعة الطلب وتأكيد شحن المحفظة خلال ساعات.
                                            </p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmitManualRequest} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold">المبلغ المراد شحنه (ج.م)</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="مثال: 500"
                                                    className="h-12 rounded-xl border-2 focus-visible:ring-primary/20"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold">الرقم المحول منه</Label>
                                                <Input
                                                    placeholder="رقم المحفظة التي قمت بالتحويل منها"
                                                    className="h-12 rounded-xl border-2 focus-visible:ring-primary/20"
                                                    value={senderNumber}
                                                    onChange={(e) => setSenderNumber(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">إثبات التحويل (سكرين شوت)</Label>
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                    onChange={handleFileUpload}
                                                    required={!file}
                                                />
                                                <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-2 transition-all ${file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/30 hover:bg-muted/30"}`}>
                                                    <CloudUpload className={`h-10 w-10 ${file ? "text-primary" : "text-muted-foreground/50"}`} />
                                                    <p className="text-sm font-bold">{file ? file.name : "اضغط هنا لرفع الصورة أو اسحبها"}</p>
                                                    <p className="text-[10px] text-muted-foreground">JPEG, PNG تصل إلى 5 ميجابايت</p>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-12 rounded-xl font-bold shadow-lg hover:shadow-primary/20 transition-all gap-2"
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    جاري معالجة الطلب...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    تأكيد وإرسال طلب الشحن اليدوي
                                                </>
                                            )}
                                        </Button>
                                    </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: History */}
                <div className="space-y-6">
                    <Card className="border-2 shadow-sm h-fit">
                        <CardHeader className="bg-muted/30 border-b">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    سجل عمليات الشحن
                                </CardTitle>
                                <Button variant="ghost" size="sm" asChild className="text-xs font-bold gap-1 text-primary hover:text-primary">
                                    <Link href="/dashboard/wallet/history">
                                        <span>السجل الكامل</span>
                                        <ArrowRight className="h-3 w-3" />
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {history.length === 0 ? (
                                <div className="p-8 text-center space-y-2">
                                    <AlertCircle className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                                    <p className="text-xs text-muted-foreground italic">لا توجد عمليات شحن سابقة</p>
                                </div>
                            ) : (
                                <div className="divide-y max-h-[500px] overflow-y-auto">
                                    {history.map((req) => (
                                        <div key={req.id} className="p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-black">{req.amount} ج.م</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(req.created_at).toLocaleString('ar-EG')}
                                                    </span>
                                                </div>
                                                <Badge
                                                    variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}
                                                    className="rounded-full text-[10px] gap-1 px-2.5 py-0.5"
                                                >
                                                    {req.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                                                    {req.status === 'pending' && <Clock className="h-3 w-3" />}
                                                    {req.status === 'pending_payment' && <Clock className="h-3 w-3" />}
                                                    {req.status === 'rejected' && <XCircle className="h-3 w-3" />}
                                                    {req.status === 'approved' ? 'مقبول ومضاف' : req.status === 'rejected' ? 'مرفوض' : req.status === 'pending_payment' ? 'بانتظار السداد' : 'بانتظار المراجعة'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg truncate">
                                                {req.payment_gateway === 'fawaterak' ? (
                                                    <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                                                ) : (
                                                    <Smartphone className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                                <span className="truncate">{req.sender_number || "دفع إلكتروني فواتيرك"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Full Ledger CTA Button */}
                            <div className="p-3 border-t bg-muted/20 text-center">
                                <Button variant="outline" size="sm" asChild className="w-full text-xs font-bold gap-2 rounded-xl shadow-xs">
                                    <Link href="/dashboard/wallet/history">
                                        <History className="h-4 w-4 text-primary" />
                                        <span>عرض السجل المالي والمدفوعات بالكامل 📊</span>
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-6 bg-orange-500/5 border-2 border-orange-500/10 rounded-2xl space-y-3">
                        <h4 className="font-bold text-orange-700 text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            تنبيه هام
                        </h4>
                        <p className="text-xs text-orange-800/80 leading-relaxed font-medium">
                            الدفع الإلكتروني بالبطاقات سيتم فتحه قريباً. حالياً يتم شحن المحفظة بالتحويل اليدوي (فودافون كاش / إنستاباي) ويتم فحص وتأكيد الإيصالات من قبل فريق الدعم.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function WalletPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <WalletContent />
        </Suspense>
    )
}
