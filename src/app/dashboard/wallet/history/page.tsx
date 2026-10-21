"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { collection, query, where, getDocs } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Wallet,
    History,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Clock,
    XCircle,
    Search,
    CreditCard,
    Smartphone,
    BookOpen,
    Filter,
    Download,
    ExternalLink,
    ShieldCheck,
    TrendingUp,
    TrendingDown,
    Loader2
} from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"

export default function WalletHistoryPage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [transactions, setTransactions] = useState<any[]>([])
    const [filterType, setFilterType] = useState<"all" | "recharge" | "course">("all")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                await fetchAllFinancialData(currentUser.uid)
            } else {
                setIsLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchAllFinancialData(uid: string) {
        setIsLoading(true)
        try {
            // 1. Fetch profile with real-time balance
            try {
                const res = await fetch("/api/profile/me")
                if (res.ok) {
                    const pData = await res.json()
                    setProfile(pData)
                }
            } catch (err) {
                console.error("Profile fetch error:", err)
            }

            // 2. Fetch Wallet Requests (manual & fawaterak recharges)
            const walletRequestsQuery = query(
                collection(db, "wallet_requests"),
                where("student_id", "==", uid)
            )
            const walletSnap = await getDocs(walletRequestsQuery)
            const walletItems = walletSnap.docs.map(doc => {
                const data = doc.data()
                return {
                    id: doc.id,
                    type: "recharge",
                    title: data.payment_gateway === "fawaterak" ? "شحن محفظة (فواتيرك)" : "شحن محفظة يدوي",
                    details: data.sender_number || "تحويل يدوي",
                    proof_url: data.screenshot_url || data.proof_url || null,
                    amount: Number(data.amount || 0),
                    is_credit: true,
                    payment_method: data.payment_gateway === "fawaterak" ? "fawaterak" : "manual",
                    status: data.status || "pending",
                    created_at: data.created_at || new Date().toISOString(),
                }
            })

            // 3. Fetch Transactions (course enrollments, payouts, fawaterak course purchases)
            const txQuery = query(
                collection(db, "transactions"),
                where("student_id", "==", uid)
            )
            const txSnap = await getDocs(txQuery)
            const txItems = txSnap.docs.map(doc => {
                const data = doc.data()
                const isFawaterak = data.type === "course_purchase_fawaterak" || data.payment_method === "fawaterak"
                const isWalletRecharge = data.type === "wallet_recharge"

                if (isWalletRecharge) {
                    // Already captured in wallet_requests, avoid duplicate view
                    return null
                }

                return {
                    id: doc.id,
                    type: "course",
                    title: `شراء كورس: ${data.course_title || "دورة تعليمية"}`,
                    details: isFawaterak ? "دفع إلكتروني فوري (فواتيرك)" : "خصم من رصيد المحفظة الداخلي",
                    amount: Number(data.amount || 0),
                    is_credit: false,
                    payment_method: isFawaterak ? "fawaterak" : "wallet",
                    status: data.status === "completed" || data.status === "success" ? "approved" : (data.status || "approved"),
                    created_at: data.created_at || new Date().toISOString(),
                }
            }).filter(Boolean) as any[]

            // Combine and sort descending by date
            const combined = [...walletItems, ...txItems].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )

            setTransactions(combined)
        } catch (error) {
            console.error("Error loading financial ledger:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter logic
    const filteredTransactions = transactions.filter(tx => {
        if (filterType !== "all" && tx.type !== filterType) return false
        if (filterStatus !== "all") {
            if (filterStatus === "approved" && tx.status !== "approved" && tx.status !== "completed") return false
            if (filterStatus === "pending" && tx.status !== "pending" && tx.status !== "pending_payment") return false
            if (filterStatus === "rejected" && tx.status !== "rejected") return false
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            const matchTitle = (tx.title || "").toLowerCase().includes(q)
            const matchDetails = (tx.details || "").toLowerCase().includes(q)
            if (!matchTitle && !matchDetails) return false
        }
        return true
    })

    // Financial summaries
    const totalRecharged = transactions
        .filter(tx => tx.type === "recharge" && (tx.status === "approved" || tx.status === "completed"))
        .reduce((acc, tx) => acc + tx.amount, 0)

    const totalSpent = transactions
        .filter(tx => tx.type === "course" && (tx.status === "approved" || tx.status === "completed"))
        .reduce((acc, tx) => acc + tx.amount, 0)

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col font-arabic">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col font-arabic bg-muted/10">
            <Navbar />
            <main className="flex-1 container py-8 max-w-6xl mx-auto space-y-8 animate-in fade-in-50" dir="rtl">
                {/* Header & Back Link */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-muted-foreground p-0 h-auto hover:bg-transparent">
                                <Link href="/dashboard/wallet">
                                    <ArrowRight className="h-4 w-4" />
                                    <span>العودة للمحفظة</span>
                                </Link>
                            </Button>
                        </div>
                        <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
                            <History className="h-8 w-8 text-primary" />
                            السجل المالي الشامل
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1">
                            سجل دقيق وموثق لجميع عمليات الشحن اليدوي والإلكتروني، ومشتريات الكورسات وحالات الدفع.
                        </p>
                    </div>

                    <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl self-start sm:self-auto font-bold shadow-xs">
                        <Link href="/dashboard/wallet">
                            <Wallet className="h-4 w-4 text-primary" />
                            <span>شحن المحفظة</span>
                        </Link>
                    </Button>
                </div>

                {/* Financial Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border-2 shadow-xs bg-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground font-bold flex items-center justify-between">
                                <span>الرصيد المتاح الحالي</span>
                                <Wallet className="h-4 w-4 text-primary" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-primary">
                                {(profile?.wallet_balance || 0).toLocaleString()} <span className="text-sm font-bold">ج.م</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 shadow-xs bg-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground font-bold flex items-center justify-between">
                                <span>إجمالي الشحن المعتمد</span>
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-emerald-600">
                                {totalRecharged.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 shadow-xs bg-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground font-bold flex items-center justify-between">
                                <span>إجمالي مدفوعات الكورسات</span>
                                <TrendingDown className="h-4 w-4 text-indigo-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-indigo-600">
                                {totalSpent.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Search */}
                <Card className="rounded-2xl border-2 shadow-xs">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Type tabs */}
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Button
                                    type="button"
                                    variant={filterType === "all" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilterType("all")}
                                    className="rounded-xl text-xs font-bold"
                                >
                                    الكل ({transactions.length})
                                </Button>
                                <Button
                                    type="button"
                                    variant={filterType === "recharge" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilterType("recharge")}
                                    className="rounded-xl text-xs font-bold gap-1.5"
                                >
                                    <Wallet className="h-3.5 w-3.5" />
                                    عمليات الشحن ({transactions.filter(t => t.type === "recharge").length})
                                </Button>
                                <Button
                                    type="button"
                                    variant={filterType === "course" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilterType("course")}
                                    className="rounded-xl text-xs font-bold gap-1.5"
                                >
                                    <BookOpen className="h-3.5 w-3.5" />
                                    شراء الكورسات ({transactions.filter(t => t.type === "course").length})
                                </Button>
                            </div>

                            {/* Search Box */}
                            <div className="relative w-full md:w-72">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="بحث في البيان أو الرقم..."
                                    className="h-10 pr-9 rounded-xl text-xs font-bold border-2"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Status filter badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                            <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                                <Filter className="h-3.5 w-3.5" />
                                الحالة:
                            </span>
                            {[
                                { key: "all", label: "جميع الحالات" },
                                { key: "approved", label: "مكتمل ومقبول ✅" },
                                { key: "pending", label: "قيد المراجعة / الانتظار ⏳" },
                                { key: "rejected", label: "مرفوض ❌" },
                            ].map(item => (
                                <Badge
                                    key={item.key}
                                    variant={filterStatus === item.key ? "default" : "outline"}
                                    onClick={() => setFilterStatus(item.key)}
                                    className="cursor-pointer text-xs font-bold py-1 px-3 rounded-lg transition-all"
                                >
                                    {item.label}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Transactions Table */}
                <Card className="rounded-2xl border-2 shadow-xs overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-4">
                        <CardTitle className="text-base font-bold flex items-center justify-between">
                            <span>جدول المعاملات المالية ({filteredTransactions.length})</span>
                            <span className="text-xs text-muted-foreground font-normal">يتم التحديث لحظياً</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredTransactions.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <History className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                                <h3 className="font-bold text-base text-foreground">لا توجد معاملات مسجلة</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                    لم يتم العثور على أي معاملات تطابق معايير البحث والفلترة المحددة.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-muted/50 text-muted-foreground border-b font-bold text-[11px]">
                                        <tr>
                                            <th className="p-3.5 pr-6">نوع المعاملة والبيان</th>
                                            <th className="p-3.5">طريقة الدفع</th>
                                            <th className="p-3.5">المبلغ</th>
                                            <th className="p-3.5">الحالة</th>
                                            <th className="p-3.5">التاريخ والوقت</th>
                                            <th className="p-3.5 pl-6 text-left">التفاصيل</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredTransactions.map((tx) => {
                                            const isApproved = tx.status === "approved" || tx.status === "completed"
                                            const isPending = tx.status === "pending" || tx.status === "pending_payment"
                                            const isRejected = tx.status === "rejected"

                                            return (
                                                <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                                                    {/* Title & Type */}
                                                    <td className="p-3.5 pr-6 font-bold space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            {tx.type === "recharge" ? (
                                                                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                                                    <Wallet className="h-4 w-4" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                                                                    <BookOpen className="h-4 w-4" />
                                                                </div>
                                                            )}
                                                            <span className="text-foreground text-xs">{tx.title}</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-normal pr-9">
                                                            {tx.details}
                                                        </p>
                                                    </td>

                                                    {/* Payment Method */}
                                                    <td className="p-3.5">
                                                        <div className="flex items-center gap-1.5 font-bold text-[11px] text-muted-foreground">
                                                            {tx.payment_method === "fawaterak" ? (
                                                                <>
                                                                    <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                    <span>فواتيرك (إلكتروني فوري)</span>
                                                                </>
                                                            ) : tx.payment_method === "wallet" ? (
                                                                <>
                                                                    <Wallet className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                                                    <span>رصيد المحفظة</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Smartphone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                                    <span>تحويل يدوي</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Amount */}
                                                    <td className="p-3.5">
                                                        <span className={`text-sm font-black ${
                                                            tx.is_credit ? "text-emerald-600" : "text-foreground"
                                                        }`}>
                                                            {tx.is_credit ? "+" : "-"} {tx.amount.toLocaleString()} ج.م
                                                        </span>
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="p-3.5">
                                                        <Badge
                                                            variant={isApproved ? "default" : isRejected ? "destructive" : "secondary"}
                                                            className="rounded-full text-[10px] gap-1 px-2.5 py-0.5 font-bold"
                                                        >
                                                            {isApproved && <CheckCircle2 className="h-3 w-3" />}
                                                            {isPending && <Clock className="h-3 w-3" />}
                                                            {isRejected && <XCircle className="h-3 w-3" />}
                                                            {isApproved
                                                                ? "مكتمل ومعتمد"
                                                                : isRejected
                                                                ? "مرفوض"
                                                                : "قيد المراجعة / السداد"}
                                                        </Badge>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="p-3.5 text-muted-foreground text-[11px]">
                                                        {new Date(tx.created_at).toLocaleString("ar-EG", {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </td>

                                                    {/* Proof image / link */}
                                                    <td className="p-3.5 pl-6 text-left">
                                                        {tx.proof_url ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                asChild
                                                                className="h-7 text-[10px] rounded-lg gap-1 px-2 font-bold"
                                                            >
                                                                <a href={tx.proof_url} target="_blank" rel="noopener noreferrer">
                                                                    <span>معاينة الإيصال</span>
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            </Button>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground/60">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
