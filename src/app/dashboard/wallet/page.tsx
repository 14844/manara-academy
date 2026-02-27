"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc, collection, addDoc, query, where, getDocs, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
    AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { supabase, SUPABASE_BUCKET } from "@/lib/supabase/config"
import { Badge } from "@/components/ui/badge"

export default function WalletPage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [history, setHistory] = useState<any[]>([])

    // Form state
    const [amount, setAmount] = useState("")
    const [senderNumber, setSenderNumber] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                fetchProfile(currentUser.uid)
                fetchHistory(currentUser.uid)
            } else {
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchProfile(uid: string) {
        const pDoc = await getDoc(doc(db, "profiles", uid))
        if (pDoc.exists()) setProfile(pDoc.data())
        setLoading(false)
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

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!amount || !senderNumber || !file) {
            toast.error("يرجى ملء جميع البيانات ورفع صورة التحويل")
            return
        }

        setSubmitting(true)
        try {
            // 1. Upload screenshot to Supabase
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.uid}_${Date.now()}.${fileExt}`
            const filePath = `payment_proofs/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(SUPABASE_BUCKET)
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from(SUPABASE_BUCKET)
                .getPublicUrl(filePath)

            // 2. Create request in Firestore
            await addDoc(collection(db, "wallet_requests"), {
                student_id: user.uid,
                student_name: profile?.full_name || user.displayName,
                student_email: user.email,
                student_unique_id: profile?.student_id || "N/A",
                amount: Number(amount),
                sender_number: senderNumber,
                screenshot_url: publicUrl,
                status: "pending",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })

            toast.success("تم إرسال طلب الشحن بنجاح! سيتم مراجعته من قبل الإدارة خلال ساعات.")

            // Clean up
            setAmount("")
            setSenderNumber("")
            setFile(null)
            fetchHistory(user.uid)
        } catch (error: any) {
            console.error("Wallet request error:", error)
            toast.error("حدث خطأ أثناء إرسال الطلب")
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
                <p className="text-muted-foreground mt-1 italic">بوابتك لإدارة رصيدك والتحكم الدقيق في عمليات الشراء</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Balance & Charge Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Balance Card */}
                    <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
                        <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <CardHeader>
                            <CardTitle className="text-lg font-medium opacity-80">الرصيد الحالي</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-8">
                            <div className="flex items-baseline gap-3">
                                <span className="text-5xl font-black">{profile?.wallet_balance?.toLocaleString() || 0}</span>
                                <span className="text-xl font-bold opacity-80">ج.م</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Charge Form */}
                    <Card className="border-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <PlusCircle className="h-5 w-5 text-primary" />
                                شحن المحفظة
                            </CardTitle>
                            <CardDescription>اتبع الخطوات التالية لشحن رصيدك بأمان</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Instructions */}
                            <div className="bg-muted/50 p-6 rounded-2xl space-y-4 border-2 border-dashed border-primary/20">
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <Smartphone className="h-4 w-4 text-primary" />
                                    خطوات الدفع عبر إنستا باي (InstaPay)
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-primary/10">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground font-bold">رقم التحويل (إنستا باي)</p>
                                            <p className="text-lg font-black tracking-widest text-primary">01122331600</p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard("01122331600")} className="h-10 w-10 text-primary">
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        * قم بتحويل المبلغ المطلوب للرقم أعلاه، ثم قم بتصوير "سكرين شوت" لعملية التحويل الناجحة وإرفاقها في النموذج أدناه. سيتم مراجعة الطلب وإضافة الرصيد لحسابك.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmitRequest} className="space-y-4">
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
                                            تأكيد وإرسال لطلب الشحن
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
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <History className="h-5 w-5" />
                                سجل العمليات
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {history.length === 0 ? (
                                <div className="p-8 text-center space-y-2">
                                    <AlertCircle className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                                    <p className="text-xs text-muted-foreground italic">لا توجد عمليات شحن سابقة</p>
                                </div>
                            ) : (
                                <div className="divide-y">
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
                                                    className="rounded-full text-[10px] gap-1 px-2 py-0.5"
                                                >
                                                    {req.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                                                    {req.status === 'pending' && <Clock className="h-3 w-3" />}
                                                    {req.status === 'rejected' && <XCircle className="h-3 w-3" />}
                                                    {req.status === 'approved' ? 'مقبول' : req.status === 'rejected' ? 'مرفوض' : 'بانتظار المراجعة'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg truncate">
                                                <Smartphone className="h-3 w-3" />
                                                <span>من: {req.sender_number}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="p-6 bg-orange-500/5 border-2 border-orange-500/10 rounded-2xl space-y-3">
                        <h4 className="font-bold text-orange-700 text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            تنبيه هام
                        </h4>
                        <p className="text-xs text-orange-800/80 leading-relaxed font-medium">
                            عمليات الشحن تتم مراجعتها بدقة من قبل الإدارة. أي محاولة تزيير لإثباتات الدفع قد تؤدي إلى تجميد حسابك نهائياً.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
