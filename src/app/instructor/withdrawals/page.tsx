"use client"

import { useState, useEffect, useRef } from "react"
import { auth, db } from "@/lib/firebase/config"
import { escapeHtml } from "@/lib/escape-html"
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    serverTimestamp, 
    doc, 
    getDoc, 
    orderBy,
    runTransaction,
    increment
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Wallet,
    ArrowUpRight,
    History,
    DollarSign,
    Clock,
    CheckCircle2,
    AlertCircle,
    Printer,
    ArrowLeft,
    Loader2,
    ShieldCheck
} from "lucide-react"
import { toast } from "sonner"
import { logActivity } from "@/lib/activity-logger"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { WalletSkeleton } from "@/components/skeletons"

export default function InstructorWithdrawalsPage() {
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [balance, setBalance] = useState({ net: 0 })
    const [requests, setRequests] = useState<any[]>([])
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [showReceipt, setShowReceipt] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                fetchFinancialData(currentUser.uid)
            } else {
                setIsLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchFinancialData(instructorId: string) {
        try {
            setIsLoading(true)
            
            // 1. Fetch Instructor Profile for real-time balance
            let profileData: any = { wallet_balance: 0 }
            try {
                const res = await fetch("/api/profile/me")
                if (res.ok) {
                    profileData = await res.json()
                }
            } catch (err) {
                console.error("Error fetching instructor profile:", err)
            }
            
            // 2. Fetch withdrawal requests
            const requestsQ = query(
                collection(db, "withdrawal_requests"),
                where("instructor_id", "==", instructorId)
            )
            const requestsSnap = await getDocs(requestsQ)
            const allRequests = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setRequests(allRequests.sort((a: any, b: any) =>
                new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
            ))

            // 3. Set the balance directly from the profile
            // We use the net balance directly from instructor's profile wallet
            const currentNet = profileData.wallet_balance || 0
            
            // The wallet already holds your share: commission was taken per sale (see /instructor/earnings).
            setBalance({ net: Number(currentNet) || 0 })

            // Note: We can also fetch from the 'transactions' collection for exact history
            // but for immediate UI fix, using wallet_balance is most accurate to the actual money.

        } catch (error) {
            console.error("Error fetching financial data:", error)
            toast.error("حدث خطأ أثناء تحميل البيانات المالية")
        } finally {
            setIsLoading(false)
        }
    }

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const windowUrl = 'about:blank';
        const uniqueName = new Date().getTime();
        const windowName = 'Print' + uniqueName;
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>إيصال صرف أرباح - ${escapeHtml(selectedRequest?.instructor_name)}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 40px; }
                        .receipt { border: 2px solid #eee; padding: 30px; border-radius: 15px; max-width: 600px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px solid #f0f0f0; margin-bottom: 20px; padding-bottom: 20px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #eee; padding-bottom: 5px; }
                        .total { background: #f9f9f9; padding: 15px; border-radius: 10px; margin-top: 20px; display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; }
                        .footer { margin-top: 40px; text-align: center; color: #888; font-size: 0.8em; }
                        .stamp { display: flex; justify-content: space-between; margin-top: 50px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                    <div class="stamp">
                        <div>توقيع الإدارة / الختم الرسمي</div>
                        <div>توقيع المستلم (المحاضر)</div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };
    const handleRequestWithdrawal = async () => {
        if (balance.net <= 0) {
            toast.error("لا يوجد رصيد متاح للسحب")
            return
        }

        setIsSubmitting(true)
        try {
            const instructorId = user.uid
            const netAmount = balance.net

            const res = await fetch("/api/instructor/withdrawals/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ net_amount: netAmount }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.error || "فشل إرسال طلب السحب")
            }

            toast.success("تم إرسال طلب السحب بنجاح وخصمه من محفظتك مؤقتاً")
            setShowRequestModal(false)
            fetchFinancialData(instructorId)

            // Log activity
            logActivity({
                action: "withdrawal_requested",
                category: "financial",
                title: "طلب سحب أرباح محاضر",
                description: `قام المحاضر بطلب سحب ${netAmount} ج.م من رصيد محفظته`,
                status: "pending",
                user_id: instructorId,
                user_name: user.displayName || "محاضر",
                user_email: user.email || "",
                user_role: "instructor",
                amount: netAmount,
                metadata: {
                    net_amount: netAmount,
                    withdrawal_id: data.requestId || "pending_req",
                }
            }).catch(() => {})
        } catch (error: any) {
            console.error("Error requesting withdrawal:", error)

            logActivity({
                action: "withdrawal_request_failed",
                category: "financial",
                title: "فشل طلب سحب أرباح",
                description: `فشل طلب سحب أرباح للمحاضر: ${error.message || "خطأ غير معروف"}`,
                status: "failed",
                user_id: user?.uid,
                user_name: user?.displayName || "محاضر",
                user_email: user?.email || "",
                user_role: "instructor",
                amount: balance?.net || 0,
                error_message: error.message,
            }).catch(() => {})

            toast.error(error.message || "حدث خطأ أثناء إرسال الطلب")
        } finally {
            setIsSubmitting(false)
        }
    }

    const sortedRequests = [...requests].sort((a: any, b: any) =>
        new Date(b.requested_at || b.created_at).getTime() - new Date(a.requested_at || a.created_at).getTime()
    )
    const hasPending = sortedRequests.some(r => r.status === "pending")
    const latestReq = sortedRequests[0]
    const lastReqTime = latestReq ? new Date(latestReq.requested_at || latestReq.created_at).getTime() : 0
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const diffMs = Date.now() - lastReqTime
    const isWithinWeek = latestReq && diffMs < sevenDaysMs
    const remainingDays = Math.ceil((sevenDaysMs - diffMs) / (1000 * 60 * 60 * 24))
    const nextEligibleDate = latestReq ? new Date(lastReqTime + sevenDaysMs).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : ""

    if (isLoading) {
        return <WalletSkeleton />
    }

    return (
        <div className="space-y-8 font-arabic rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/instructor">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">المحفظة والسحب</h1>
                        <p className="text-muted-foreground">رصيدك جاهز للسحب — العمولة اتخصمت وقت كل بيع</p>
                    </div>
                </div>
            </div>

            {/* Negative Balance Alert */}
            {balance.net < 0 && (
                <div className="p-4 rounded-2xl border-2 border-red-500/30 bg-red-500/10 text-red-700 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                        <h4 className="font-bold text-sm">تنبيه مالي: رصيد المحفظة الحالي بالسالب ({balance.net.toLocaleString()} ج.م)</h4>
                        <p className="leading-relaxed">
                            تم تسجيل رصيد سالب نتيجة استرداد بنكي أو إلغاء كورس سابق (Chargeback / Refund). سيتم تسوية هذا المبلغ تلقائياً وخصمه من مبيعات الكورسات القادمة حتى يعود الرصيد موجباً.
                        </p>
                    </div>
                </div>
            )}

            {/* Transparency & Money Flow Banner */}
            <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        <span>إزاي فلوسك بتوصلك</span>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                            السحب أسبوعياً ⏱️
                        </Badge>
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                        مع كل بيع، عمولة المنصة (حسب باقتك وقتها) بتتخصم مرة واحدة، ونصيبك بيتحط في رصيدك فوراً — تفاصيل كل بيع في{" "}
                        <Link href="/instructor/earnings" className="font-bold text-primary underline-offset-4 hover:underline">أرباحي</Link>.
                        السحب بيكون من رصيد المحفظة زي ما هو <strong className="text-foreground">من غير أي خصم إضافي</strong>، ومسموح بطلب سحب <strong className="text-foreground">مرة كل 7 أيام</strong>.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className={`text-primary-foreground shadow-xl border-none overflow-hidden relative ${balance.net < 0 ? 'bg-red-600' : 'bg-primary'}`}>
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Wallet className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-80 uppercase tracking-wider">
                            {balance.net < 0 ? "الرصيد المستحق (مدين)" : "رصيد المحفظة المتاح للسحب"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-4xl font-black">
                            {balance.net.toLocaleString()} <span className="text-lg">ج.م</span>
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            {balance.net <= 0 ? (
                                <Button disabled className="w-full bg-white/20 text-white cursor-not-allowed font-bold gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    {balance.net < 0 ? "الرصيد بالسالب (غير مؤهل للسحب)" : "لا يوجد رصيد متاح للسحب"}
                                </Button>
                            ) : hasPending ? (
                                <Button disabled className="w-full bg-white/20 text-white cursor-not-allowed font-bold gap-2">
                                    <Clock className="h-4 w-4" />
                                    يوجد طلب سحب قيد المعالجة
                                </Button>
                            ) : isWithinWeek ? (
                                <Button disabled className="w-full bg-white/20 text-white cursor-not-allowed font-bold text-xs gap-1.5">
                                    <Clock className="h-4 w-4" />
                                    السحب القادم متاح بعد {remainingDays} {remainingDays === 1 ? 'يوم' : 'أيام'} ({nextEligibleDate})
                                </Button>
                            ) : (
                                <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full bg-white text-primary hover:bg-zinc-100 font-bold gap-2">
                                            <ArrowUpRight className="h-4 w-4" />
                                            طلب سحب الأرباح الآن
                                        </Button>
                                    </DialogTrigger>
                                <DialogContent className="font-arabic rtl">
                                    <DialogHeader>
                                        <DialogTitle>تأكيد طلب السحب</DialogTitle>
                                        <DialogDescription>
                                            سيتم مراجعة الطلب وتحويل المبلغ خلال 48 ساعة عمل.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <p className="text-sm text-muted-foreground">
                                            هيتسحب رصيد محفظتك بالكامل. العمولة اتخصمت بالفعل وقت كل بيع، فمفيش أي خصم تاني على السحب.
                                        </p>
                                        <div className="flex justify-between p-4 bg-primary/10 text-primary border-2 border-primary/20 rounded-xl">
                                            <span className="font-bold">المبلغ اللي هيتحول لك:</span>
                                            <span className="text-2xl font-black">{balance.net.toLocaleString()} ج.م</span>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={handleRequestWithdrawal}
                                            disabled={isSubmitting || balance.net <= 0}
                                            className="w-full font-bold"
                                        >
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                            تأكيد إرسال الطلب
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200/60 shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            مبيعاتك وعمولتها
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <p className="text-muted-foreground leading-relaxed">
                            كل بيع بيظهر بالتفصيل: الطالب دفع كام، المنصة أخدت كام حسب باقتك، ونصيبك كام.
                        </p>
                        <Button variant="outline" className="min-h-11 w-full font-bold" asChild>
                            <Link href="/instructor/earnings">شوف أرباحي بالتفصيل</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200/60 shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            حالة السحب الحالية
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-[120px] text-center">
                        {requests.length > 0 && requests[0].status === 'pending' ? (
                            <div className="space-y-2">
                                <div className="text-orange-600 font-bold animate-pulse flex items-center gap-1 justify-center">
                                    <Clock className="h-4 w-4" /> قيد المراجعة
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">يوجد طلب سحب بمبلغ {requests[0].net_amount} ج.م بانتظار الموافقة</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                                <p className="text-xs font-bold">لا توجد طلبات معلقة</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-zinc-200/60 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        سجل العمليات والطلبات
                    </CardTitle>
                    <CardDescription>متابعة كافة طلبات السحب والحالات الخاصة بها</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-4 font-bold">التاريخ</th>
                                    <th className="p-4 font-bold">المبلغ</th>
                                    <th className="p-4 font-bold">الحالة</th>
                                    <th className="p-4 font-bold">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-zinc-600">
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground italic">
                                            لا توجد طلبات سحب سابقة
                                        </td>
                                    </tr>
                                ) : (
                                    requests.map((req) => (
                                        <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-4 font-medium whitespace-nowrap">
                                                {new Date(req.requested_at).toLocaleDateString('ar-EG', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="p-4 font-bold text-foreground whitespace-nowrap">{Number(req.net_amount ?? req.amount ?? 0).toLocaleString()} ج.م</td>
                                            <td className="p-4">
                                                {req.status === 'pending' && <Badge className="bg-orange-500/10 text-orange-600 border-orange-200">قيد المراجعة</Badge>}
                                                {req.status === 'paid' && <Badge className="bg-green-500/10 text-green-600 border-green-200">تم الدفع</Badge>}
                                                {req.status === 'rejected' && <Badge variant="destructive">مرفوض</Badge>}
                                            </td>
                                            <td className="p-4 text-center">
                                                {req.status === 'paid' && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        title="طباعة الإيصال"
                                                        onClick={() => {
                                                            setSelectedRequest(req)
                                                            setShowReceipt(true)
                                                        }}
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {req.status === 'pending' && <AlertCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="max-w-md font-arabic rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5" /> إيصال صرف أرباح
                        </DialogTitle>
                        <DialogDescription>رقم العملية: {selectedRequest?.id}</DialogDescription>
                    </DialogHeader>

                    <div className="py-2" ref={printRef}>
                        <div className="receipt">
                            <div className="header">
                                <h1 className="text-xl font-bold m-0 p-0">إيصال صرف مستحقات</h1>
                                <p className="text-sm text-zinc-500 m-0">منصة التعليم الإلكتروني - منارة أكاديمي</p>
                            </div>

                            <div className="row">
                                <span className="text-zinc-500">اسم المحاضر:</span>
                                <span className="font-bold">{selectedRequest?.instructor_name}</span>
                            </div>
                            <div className="row">
                                <span className="text-zinc-500">تاريخ الطلب:</span>
                                <span>{selectedRequest?.requested_at && new Date(selectedRequest.requested_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="row">
                                <span className="text-zinc-500">تاريخ الدفع:</span>
                                <span>{selectedRequest?.paid_at && new Date(selectedRequest.paid_at).toLocaleDateString('ar-EG')}</span>
                            </div>

                            <div className="mt-6 pt-4 border-t-2 border-zinc-100 space-y-2">
                                <div className="total">
                                    <span>المبلغ المسحوب من المحفظة:</span>
                                    <span className="text-primary">{selectedRequest?.net_amount?.toLocaleString()} ج.م</span>
                                </div>
                            </div>

                            <div className="footer">
                                <p>هذا المستند تم إنشاؤه آلياً ويعد إقراراً بصرف المبلغ الموضح أعلاه للمحاضر.</p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button className="w-full gap-2" onClick={handlePrint}>
                            <Printer className="h-4 w-4" /> طباعة أو حفظ كـ PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
