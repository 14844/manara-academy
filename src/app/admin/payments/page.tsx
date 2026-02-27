"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc, updateDoc, runTransaction, increment, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    CheckCircle,
    XCircle,
    Eye,
    AlertCircle,
    Loader2,
    Wallet,
    User,
    Calendar,
    Smartphone,
    ExternalLink,
    History as HistoryIcon
} from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

export default function AdminPaymentsPage() {
    const [requests, setRequests] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [studentBalance, setStudentBalance] = useState<number | null>(null)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [confirmingApproval, setConfirmingApproval] = useState(false)

    useEffect(() => {
        fetchRequests()
    }, [])

    useEffect(() => {
        if (selectedRequest) {
            fetchStudentBalance(selectedRequest.student_id)
        } else {
            setStudentBalance(null)
        }
    }, [selectedRequest])

    async function fetchStudentBalance(uid: string) {
        try {
            const docRef = doc(db, "profiles", uid)
            const snap = await getDoc(docRef)
            if (snap.exists()) {
                setStudentBalance(snap.data().wallet_balance || 0)
            }
        } catch (error) {
            console.error("Error fetching student balance:", error)
        }
    }

    async function fetchRequests() {
        try {
            const q = query(collection(db, "wallet_requests"), orderBy("created_at", "desc"))
            const snap = await getDocs(q)
            setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        } catch (error) {
            console.error("Error fetching requests:", error)
            toast.error("فشل في تحميل طلبات الدفع")
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (request: any) => {
        if (!confirmingApproval) {
            setConfirmingApproval(true)
            return
        }

        setIsActionLoading(true)
        try {
            await runTransaction(db, async (transaction) => {
                const profileRef = doc(db, "profiles", request.student_id)
                const requestRef = doc(db, "wallet_requests", request.id)

                const profileSnap = await transaction.get(profileRef)
                if (!profileSnap.exists()) throw new Error("Profile not found")

                // 1. Update Profile Balance
                transaction.update(profileRef, {
                    wallet_balance: increment(request.amount),
                    updated_at: new Date().toISOString()
                })

                // 2. Update Request Status
                transaction.update(requestRef, {
                    status: "approved",
                    updated_at: new Date().toISOString(),
                    reviewed_at: new Date().toISOString()
                })
            })

            toast.success("تم اعتماد الدفع وإضافة الرصيد لمحفظة الطالب")
            setSelectedRequest(null)
            setConfirmingApproval(false)
            fetchRequests()
        } catch (error) {
            console.error("Approve error:", error)
            toast.error("حدث خطأ أثناء اعتماد العملية")
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleReject = async (request: any) => {
        setIsActionLoading(true)
        try {
            const requestRef = doc(db, "wallet_requests", request.id)
            await updateDoc(requestRef, {
                status: "rejected",
                updated_at: new Date().toISOString(),
                reviewed_at: new Date().toISOString()
            })
            toast.info("تم رفض طلب الدفع")
            setSelectedRequest(null)
            setConfirmingApproval(false) // Reset confirmation state on reject
            fetchRequests()
        } catch (error) {
            console.error("Reject error:", error)
            toast.error("حدث خطأ أثناء رفض العملية")
        } finally {
            setIsActionLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const pendingRequests = requests.filter(r => r.status === 'pending')
    const historicalRequests = requests.filter(r => r.status !== 'pending')

    return (
        <div className="space-y-8 font-arabic">
            <div>
                <h1 className="text-3xl font-black flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-primary" />
                    مراجعة المدفوعات
                </h1>
                <p className="text-muted-foreground mt-2">إدارة طلبات شحن المحافظ ومراجعة إيصالات الدفع.</p>
            </div>

            {/* Pending Requests */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    طلبات بانتظار المراجعة ({pendingRequests.length})
                </h2>

                {pendingRequests.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="py-10 text-center text-muted-foreground italic">
                            لا توجد طلبات معلقة حالياً.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pendingRequests.map((req) => (
                            <Card key={req.id} className="border-2 hover:border-primary/30 transition-all">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="secondary" className="text-xs">{req.student_unique_id}</Badge>
                                        <span className="text-xl font-black text-primary">{req.amount} ج.م</span>
                                    </div>
                                    <CardTitle className="text-lg mt-2">{req.student_name}</CardTitle>
                                    <CardDescription className="flex items-center gap-1 text-[10px]">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(req.created_at).toLocaleString('ar-EG')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted p-2 rounded-lg truncate">
                                        <Smartphone className="h-3.5 w-3.5" />
                                        <span>من: {req.sender_number}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-0 flex gap-2">
                                    <Button className="w-full gap-2 font-bold" onClick={() => {
                                        setSelectedRequest(req);
                                        setConfirmingApproval(false);
                                    }}>
                                        <Eye className="h-4 w-4" />
                                        مراجعة الإيصال
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {/* Historical Requests Table */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <HistoryIcon className="h-5 w-5 text-muted-foreground" />
                    السجل التاريخي
                </h2>
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-3">الطالب</th>
                                        <th className="px-6 py-3">المبلغ</th>
                                        <th className="px-6 py-3">الرقم المرسل</th>
                                        <th className="px-6 py-3">التاريخ</th>
                                        <th className="px-6 py-3">الحالة</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {historicalRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-muted/50">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{req.student_name}</span>
                                                    <span className="text-[10px] opacity-60">{req.student_unique_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-black">{req.amount} ج.م</td>
                                            <td className="px-6 py-4 text-xs font-mono">{req.sender_number}</td>
                                            <td className="px-6 py-4 text-xs">{new Date(req.created_at).toLocaleDateString('ar-EG')}</td>
                                            <td className="px-6 py-4">
                                                <Badge
                                                    variant={req.status === 'approved' ? 'default' : 'destructive'}
                                                    className="text-[10px] rounded-full"
                                                >
                                                    {req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(req)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Review Dialog */}
            <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-w-2xl font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">مراجعة طلب الشحن</DialogTitle>
                        <DialogDescription>يرجى التأكد من صحة الإيصال والمبلغ قبل الاعتماد.</DialogDescription>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">تفاصيل الطالب</Label>
                                    <div className="p-3 bg-muted rounded-xl space-y-1">
                                        <p className="font-bold">{selectedRequest.student_name}</p>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="opacity-70">{selectedRequest.student_email}</span>
                                            <span className="font-mono text-primary">{selectedRequest.student_unique_id}</span>
                                        </div>
                                        <div className="pt-2 border-t mt-1 flex justify-between items-center bg-white/50 p-2 rounded-lg">
                                            <span className="text-[10px] font-bold">الرصيد الحالي بالمحفظة:</span>
                                            <span className="font-black text-orange-600">{studentBalance !== null ? `${studentBalance} ج.م` : "جاري التحميل..."}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">بيانات العملية</Label>
                                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                                            <span className="text-sm font-bold">المبلغ المطلوب إضافته:</span>
                                            <span className="text-2xl font-black text-primary underline underline-offset-4 decoration-2">{selectedRequest.amount} ج.م</span>
                                        </div>
                                        <div className="flex justify-between text-xs px-1">
                                            <span className="opacity-60">الرقم المرسل منه:</span>
                                            <span className="font-bold">{selectedRequest.sender_number}</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedRequest.status === 'pending' && (
                                    <div className="flex flex-col gap-2 pt-4">
                                        {!confirmingApproval ? (
                                            <>
                                                <Button
                                                    className="w-full h-12 rounded-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 gap-2"
                                                    onClick={() => {
                                                        setConfirmingApproval(true);
                                                    }}
                                                    disabled={isActionLoading}
                                                >
                                                    <CheckCircle className="h-5 w-5" />
                                                    اعتماد وإضافة الرصيد
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-12 rounded-xl font-bold text-destructive border-destructive/20 hover:bg-destructive/5 gap-2"
                                                    onClick={() => handleReject(selectedRequest)}
                                                    disabled={isActionLoading}
                                                >
                                                    <XCircle className="h-5 w-5" />
                                                    رفض الطلب
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-4 animate-in zoom-in-95 duration-200">
                                                <p className="text-sm font-bold text-center leading-relaxed">
                                                    هل أنت متأكد من إضافة مبلغ <span className="text-primary text-lg px-1">{selectedRequest.amount} ج.م</span> لمحفظة الطالب؟
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-10 rounded-lg font-bold"
                                                        onClick={() => setConfirmingApproval(false)}
                                                        disabled={isActionLoading}
                                                    >
                                                        تراجع
                                                    </Button>
                                                    <Button
                                                        className="flex-1 h-12 rounded-lg font-bold bg-primary shadow-lg shadow-primary/20 text-xs"
                                                        onClick={() => handleApprove(selectedRequest)}
                                                        disabled={isActionLoading}
                                                    >
                                                        {isActionLoading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            `سيتم إضافة مبلغ ${selectedRequest.amount} ج.م في محفظة الطالب`
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground flex justify-between items-center">
                                    إثبات الدفع (إيصال التحويل)
                                    <a href={selectedRequest.screenshot_url} target="_blank" className="text-primary hover:underline flex items-center gap-1 font-bold">
                                        فتح في نافذة جديدة
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </Label>
                                <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-primary/10 bg-zinc-900 group relative">
                                    <img
                                        src={selectedRequest.screenshot_url}
                                        alt="إيصال الدفع"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
