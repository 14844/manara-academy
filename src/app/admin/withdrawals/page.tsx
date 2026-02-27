"use client"

import { useState, useEffect, useRef } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    CheckCircle2,
    XCircle,
    Clock,
    DollarSign,
    User,
    Calendar,
    Printer,
    Search,
    Loader2,
    TrendingUp,
    Download
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"

export default function AdminWithdrawalsPage() {
    const [requests, setRequests] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [showReceipt, setShowReceipt] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchWithdrawals()
    }, [])

    async function fetchWithdrawals() {
        try {
            setIsLoading(true)
            const q = query(
                collection(db, "withdrawal_requests"),
                orderBy("requested_at", "desc")
            )
            const snap = await getDocs(q)
            setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        } catch (error) {
            console.error("Error fetching withdrawals:", error)
            toast.error("حدث خطأ أثناء تحميل طلبات السحب")
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (request: any) => {
        if (!confirm("هل أنت متأكد من الموافقة على تحويل هذا المبلغ؟")) return

        setIsProcessing(true)
        try {
            const reqRef = doc(db, "withdrawal_requests", request.id)
            await updateDoc(reqRef, {
                status: "paid",
                paid_at: new Date().toISOString()
            })

            toast.success("تم تأكيد الدفع بنجاح")
            setSelectedRequest({ ...request, status: "paid", paid_at: new Date().toISOString() })
            setShowReceipt(true)
            fetchWithdrawals()
        } catch (error) {
            console.error("Error approving withdrawal:", error)
            toast.error("حدث خطأ أثناء معالجة الطلب")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleReject = async (requestId: string) => {
        const reason = prompt("يرجى ذكر سبب الرفض:")
        if (reason === null) return

        setIsProcessing(true)
        try {
            const reqRef = doc(db, "withdrawal_requests", requestId)
            await updateDoc(reqRef, {
                status: "rejected",
                rejection_reason: reason,
                rejected_at: new Date().toISOString()
            })

            toast.info("تم رفض الطلب")
            fetchWithdrawals()
        } catch (error) {
            console.error("Error rejecting withdrawal:", error)
            toast.error("حدث خطأ أثناء معالجة الطلب")
        } finally {
            setIsProcessing(false)
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
                    <title>إيصال صرف أرباح - منصة التعليم</title>
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
                        <div>توقيع المدير / الختم</div>
                        <div>توقيع المستلم</div>
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

    const filteredRequests = requests.filter(r =>
        r.instructor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const pendingCount = requests.filter(r => r.status === 'pending').length
    const totalPaid = requests.filter(r => r.status === 'paid').reduce((acc, r) => acc + (r.net_amount || 0), 0)

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container py-10 space-y-8 font-arabic rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">طلبات سحب الأرباح</h1>
                    <p className="text-muted-foreground">راجع ووافق على طلبات تحويل الأرباح للمدرسين</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث باسم المدرس..."
                            className="pr-10 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={fetchWithdrawals}>
                        <Clock className="ml-2 h-4 w-4" /> تحديث
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs text-muted-foreground uppercase flex items-center justify-between">
                            الطلبات المعلقة <Clock className="h-3 w-3 text-orange-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black text-orange-600">{pendingCount}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs text-muted-foreground uppercase flex items-center justify-between">
                            إجمالي المدفوعات <TrendingUp className="h-3 w-3 text-green-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black text-green-600">{totalPaid.toLocaleString()} <span className="text-xs">ج.م</span></div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-xl">
                <CardContent className="p-0">
                    <div className="overflow-x-auto rounded-xl">
                        <table className="w-full text-right">
                            <thead className="bg-zinc-50 border-b">
                                <tr>
                                    <th className="p-4 font-bold text-sm">المدرس</th>
                                    <th className="p-4 font-bold text-sm">التاريخ</th>
                                    <th className="p-4 font-bold text-sm">المبلغ الإجمالي</th>
                                    <th className="p-4 font-bold text-sm">صافي الربح</th>
                                    <th className="p-4 font-bold text-sm text-center">الحالة</th>
                                    <th className="p-4 font-bold text-sm text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                                            لا توجد طلبات سحب حالياً
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="p-4 font-bold text-zinc-800">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                                                        {req.instructor_name?.charAt(0) || "M"}
                                                    </div>
                                                    {req.instructor_name}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-zinc-500 whitespace-nowrap">
                                                {new Date(req.requested_at).toLocaleDateString('ar-EG', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="p-4 font-medium">{req.amount.toLocaleString()} ج.م</td>
                                            <td className="p-4 font-black text-primary">{req.net_amount.toLocaleString()} ج.م</td>
                                            <td className="p-4 text-center">
                                                {req.status === 'pending' && <Badge className="bg-orange-50 text-orange-600 border-orange-200">معلق</Badge>}
                                                {req.status === 'paid' && <Badge className="bg-green-50 text-green-600 border-green-200">تم الدفع</Badge>}
                                                {req.status === 'rejected' && <Badge variant="destructive">مرفوض</Badge>}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700 h-8 gap-1"
                                                                onClick={() => handleApprove(req)}
                                                                disabled={isProcessing}
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" /> موافقة
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-8 gap-1"
                                                                onClick={() => handleReject(req.id)}
                                                                disabled={isProcessing}
                                                            >
                                                                <XCircle className="h-3.5 w-3.5" /> رفض
                                                            </Button>
                                                        </>
                                                    )}
                                                    {req.status === 'paid' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1"
                                                            onClick={() => {
                                                                setSelectedRequest(req)
                                                                setShowReceipt(true)
                                                            }}
                                                        >
                                                            <Printer className="h-3.5 w-3.5" /> إيصال
                                                        </Button>
                                                    )}
                                                </div>
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
                                <p className="text-sm text-zinc-500 m-0">منصة التعليم الإلكتروني</p>
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
                                <div className="row">
                                    <span>المجموع الإجمالي:</span>
                                    <span>{selectedRequest?.amount?.toLocaleString()} ج.م</span>
                                </div>
                                <div className="row text-red-600">
                                    <span>عمولة المنصة (20%):</span>
                                    <span>-{selectedRequest?.commission?.toLocaleString()} ج.م</span>
                                </div>
                                <div className="total">
                                    <span>صافي المبلغ المدفوع:</span>
                                    <span className="text-primary">{selectedRequest?.net_amount?.toLocaleString()} ج.م</span>
                                </div>
                            </div>

                            <div className="footer">
                                <p>هذا المستند تم إنشاؤه آلياً ويعد إقراراً بصرف المبلغ الموضح أعلاه.</p>
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
