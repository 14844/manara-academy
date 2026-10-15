"use client"

import { useState, useEffect, useMemo } from "react"
import { db } from "@/lib/firebase/config"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Users,
    BookOpen,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    PieChart,
    BarChart3,
    LineChart,
    Sparkles,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Download,
    Printer,
    Coins,
    Banknote,
    Receipt,
    Lightbulb,
    Target,
    Layers,
    Calendar,
    ArrowRight
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"

export default function AdminKpisPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [timeRange, setTimeRange] = useState("all") // "month", "quarter", "year", "all"

    // Raw data
    const [transactions, setTransactions] = useState<any[]>([])
    const [enrollments, setEnrollments] = useState<any[]>([])
    const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([])
    const [walletRequests, setWalletRequests] = useState<any[]>([])
    const [profiles, setProfiles] = useState<any[]>([])
    const [courses, setCourses] = useState<any[]>([])

    useEffect(() => {
        fetchKpiData()
    }, [])

    async function fetchKpiData() {
        setIsRefreshing(true)
        try {
            // Concurrent fetch of all financial and operational collections
            const [
                txSnap,
                enrSnap,
                withSnap,
                walSnap,
                profSnap,
                coursesSnap
            ] = await Promise.all([
                getDocs(collection(db, "transactions")).catch(() => ({ docs: [] } as any)),
                getDocs(collection(db, "enrollments")).catch(() => ({ docs: [] } as any)),
                getDocs(collection(db, "withdrawal_requests")).catch(() => ({ docs: [] } as any)),
                getDocs(collection(db, "wallet_requests")).catch(() => ({ docs: [] } as any)),
                getDocs(collection(db, "profiles")).catch(() => ({ docs: [] } as any)),
                getDocs(collection(db, "courses")).catch(() => ({ docs: [] } as any)),
            ])

            setTransactions(txSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
            setEnrollments(enrSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
            setWithdrawalRequests(withSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
            setWalletRequests(walSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
            setProfiles(profSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
            setCourses(coursesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
        } catch (error: any) {
            console.error("Error fetching KPI data:", error)
            toast.error("حدث خطأ أثناء تحميل بيانات المؤشرات المالية")
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }

    // Calculations & Metrics
    const metrics = useMemo(() => {
        const now = Date.now()

        // Filter enrollments by timeRange
        const filteredEnrollments = enrollments.filter(e => {
            if (timeRange === "all") return true
            const time = new Date(e.enrolled_at || e.created_at || 0).getTime()
            if (timeRange === "month") return (now - time) <= 30 * 24 * 60 * 60 * 1000
            if (timeRange === "quarter") return (now - time) <= 90 * 24 * 60 * 60 * 1000
            if (timeRange === "year") return (now - time) <= 365 * 24 * 60 * 60 * 1000
            return true
        })

        // GMV (Gross Merchandise Value - Total Course Sales)
        let totalGmv = 0
        let totalPlatformCommission = 0
        let totalInstructorEarnings = 0

        filteredEnrollments.forEach(enr => {
            const price = Number(enr.paid_amount || enr.price || 0)
            totalGmv += price
            totalPlatformCommission += price * 0.05 // 5%
            totalInstructorEarnings += price * 0.95 // 95%
        })

        // Also check transactions collection for any direct enrollment_payout logs
        transactions.forEach(tx => {
            if (tx.type === "enrollment_payout" && (!filteredEnrollments.length)) {
                const amt = Number(tx.amount || 0)
                totalGmv += amt
                totalPlatformCommission += (tx.platform_commission || amt * 0.05)
                totalInstructorEarnings += (tx.instructor_share || amt * 0.95)
            }
        })

        // Total Recharged Money into Platform Wallets (Fawaterak + Approved Manual)
        let totalRechargedAmount = 0
        walletRequests.forEach(wr => {
            if (wr.status === "approved") {
                totalRechargedAmount += Number(wr.amount || 0)
            }
        })

        // Total Withdrawals Paid to Instructors
        let totalWithdrawalsPaid = 0
        let totalWithdrawalsPending = 0
        withdrawalRequests.forEach(wr => {
            if (wr.status === "paid") {
                totalWithdrawalsPaid += Number(wr.net_amount || wr.amount || 0)
            } else if (wr.status === "pending") {
                totalWithdrawalsPending += Number(wr.net_amount || wr.amount || 0)
            }
        })

        // Total User Balances currently held in Platform (Student wallets + Instructor wallets)
        let totalStudentWalletBalances = 0
        let totalInstructorWalletBalances = 0
        let studentCount = 0
        let instructorCount = 0

        profiles.forEach(p => {
            const bal = Number(p.wallet_balance || 0)
            if (p.role === "instructor") {
                totalInstructorWalletBalances += bal
                instructorCount++
            } else if (p.role === "student" || !p.role) {
                totalStudentWalletBalances += bal
                studentCount++
            }
        })

        // Operational Costs estimate (e.g. Bunny stream/storage, Hosting, Payment gateways)
        // Typically around 1.5% - 2.5% or fixed monthly estimate ~250 EGP
        const estimatedHostingCosts = Math.max(150, totalGmv * 0.015)
        
        // P&L: Net Profit = Platform Commission (5%) - Estimated Costs
        const netProfit = totalPlatformCommission - estimatedHostingCosts
        const isProfitable = netProfit >= 0
        const profitMargin = totalGmv > 0 ? ((netProfit / totalGmv) * 100) : 0

        // Average Order Value (AOV)
        const aov = filteredEnrollments.length > 0 ? Math.round(totalGmv / filteredEnrollments.length) : 0

        // Wallet Utilization Rate: How much of recharged money was actually spent on courses
        const walletUtilization = totalRechargedAmount > 0 
            ? Math.min(100, Math.round((totalGmv / totalRechargedAmount) * 100))
            : 0

        // Course Breakdown (Top 5 Performing Courses)
        const courseSalesMap: Record<string, { title: string; count: number; revenue: number; instructor: string }> = {}
        filteredEnrollments.forEach(enr => {
            const cId = enr.course_id || "unknown"
            if (!courseSalesMap[cId]) {
                courseSalesMap[cId] = {
                    title: enr.course_title || "كورس بدون عنوان",
                    count: 0,
                    revenue: 0,
                    instructor: enr.instructor_name || "محاضر",
                }
            }
            courseSalesMap[cId].count++
            courseSalesMap[cId].revenue += Number(enr.paid_amount || enr.price || 0)
        })

        const topCourses = Object.values(courseSalesMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        // Monthly Breakdown for Bar/Area Graph (last 6 months)
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
        const monthlyData: { month: string; gmv: number; commission: number; enrollments: number }[] = []

        for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const mIdx = d.getMonth()
            const y = d.getFullYear()
            const label = `${monthNames[mIdx]}`

            let monthGmv = 0
            let monthEnrollments = 0

            enrollments.forEach(enr => {
                const enrDate = new Date(enr.enrolled_at || enr.created_at || 0)
                if (enrDate.getMonth() === mIdx && enrDate.getFullYear() === y) {
                    monthGmv += Number(enr.paid_amount || enr.price || 0)
                    monthEnrollments++
                }
            })

            monthlyData.push({
                month: label,
                gmv: monthGmv,
                commission: monthGmv * 0.05,
                enrollments: monthEnrollments,
            })
        }

        return {
            totalGmv,
            totalPlatformCommission,
            totalInstructorEarnings,
            totalRechargedAmount,
            totalWithdrawalsPaid,
            totalWithdrawalsPending,
            totalStudentWalletBalances,
            totalInstructorWalletBalances,
            totalInCirculation: totalStudentWalletBalances + totalInstructorWalletBalances,
            estimatedHostingCosts,
            netProfit,
            isProfitable,
            profitMargin,
            aov,
            walletUtilization,
            enrollmentCount: filteredEnrollments.length,
            studentCount,
            instructorCount,
            totalCourses: courses.length,
            topCourses,
            monthlyData,
        }
    }, [enrollments, transactions, walletRequests, withdrawalRequests, profiles, courses, timeRange])

    // Dynamic AI & Financial Advisory Insights
    const advisoryInsights = useMemo(() => {
        const insights: { type: "positive" | "warning" | "opportunity"; title: string; desc: string; action: string }[] = []

        // 1. Profitability Evaluation
        if (metrics.isProfitable && metrics.totalGmv > 0) {
            insights.push({
                type: "positive",
                title: "المنصة في نطاق الربحية الإيجابية (Profitable)",
                desc: `عمولة المنصة (${metrics.totalPlatformCommission.toLocaleString()} ج.م) تغطي بالكامل تكاليف التشغيل التقديرية (${metrics.estimatedHostingCosts.toLocaleString()} ج.م) مع فائض صافي قدره ${metrics.netProfit.toLocaleString()} ج.م.`,
                action: "الحفاظ على معدل العمولة 5% مع التركيز على مضاعفة عدد الطلاب النشطين لرفع العائد الإجمالي.",
            })
        } else if (metrics.totalGmv === 0) {
            insights.push({
                type: "opportunity",
                title: "مرحلة الإطلاق الأولي (Zero-Transaction Phase)",
                desc: "لم تسجل عمليات شراء كبرى بعد. التكاليف التشغيلية منخفضة جداً والفرصة سانحة لاكتساب أول 50 طالب نشط.",
                action: "تشجيع المدرسين على نشر كوبونات خصم مجانية وترويج أول كورس عبر تيليجرام وفيسبوك لبدء دورة المبيعات.",
            })
        } else {
            insights.push({
                type: "warning",
                title: "هامش الربح التشغيلي بحاجة لدعم",
                desc: `حجم المبيعات الحالي (${metrics.totalGmv} ج.م) يقترب من حد تغطية التكاليف التشغيلية.`,
                action: "إطلاق حملات تسويقية للكورسات الأعلى قيمة، أو فرض رسوم رمزية على طلبات السحب المستعجلة.",
            })
        }

        // 2. Unspent Wallet Liquidity
        if (metrics.totalStudentWalletBalances > 200) {
            insights.push({
                type: "opportunity",
                title: "سيولة راكدة في محافظ الطلاب",
                desc: `يوجد حالياً مبلغ ${metrics.totalStudentWalletBalances.toLocaleString()} ج.م مشحون في محافظ الطلاب ولم يتم إنفاقه بعد على الكورسات!`,
                action: "إرسال إشعار ترويجي للطلاب بخصومات حصرية على الكورسات لدفعهم لتحويل هذا الرصيد إلى اشتراكات فعلية.",
            })
        }

        // 3. Average Order Value (AOV)
        if (metrics.aov > 0 && metrics.aov < 100) {
            insights.push({
                type: "opportunity",
                title: "فرصة لرفع متوسط قيمة الطلب (AOV)",
                desc: `متوسط سعر الكورس المشترى حالياً هو ${metrics.aov} ج.م، وهو رقم مناسب لطلاب المدارس لكن يمكن زيادته.`,
                action: "تشجيع المعلمين على إطلاق باقات مجمعة (Course Bundles مثل: باقة الترم كامل) لزيادة إيراد العملية الواحدة.",
            })
        }

        // 4. Instant Payment Adoption (Fawaterak)
        insights.push({
            type: "positive",
            title: "تفعيل الدفع الإلكتروني الفوري (فواتيرك)",
            desc: "توفير بوابات الدفع الفورية (فيزا، كاش، فوري) يقلل من تردد الطالب ويزيد معدل إتمام عمليات الشحن بنسبة تفوق 40% مقارنة بالتحويل اليدوي.",
            action: "توجيه الطلاب في الإعلانات إلى خيار (الدفع الفوري) لسرعة وصول الكورس بدون انتظار مراجعة يدوية.",
        })

        return insights
    }, [metrics])

    // Find max value in monthly graph for proper SVG scaling
    const maxMonthlyGmv = Math.max(...metrics.monthlyData.map(m => m.gmv), 100)

    function handlePrint() {
        window.print()
    }

    return (
        <div className="space-y-8 font-arabic print:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 print:hidden">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 rounded-xl">
                            <BarChart3 className="h-7 w-7" />
                        </div>
                        <span>المؤشرات المالية ولوحة الأداء (Finance & KPIs)</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        تحليل بياني وتفصيلي متكامل لحجم التداول، صافي أرباح إدارة المنصة (5%)، التدفقات النقدية، وتقييم الربحية والخسارة.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Time Range Selector */}
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-36 bg-background">
                            <Calendar className="w-4 h-4 ml-2 text-muted-foreground" />
                            <SelectValue placeholder="الفترة الزمنية" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الفترات</SelectItem>
                            <SelectItem value="month">آخر 30 يوم</SelectItem>
                            <SelectItem value="quarter">آخر 3 شهور</SelectItem>
                            <SelectItem value="year">هذا العام</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="gap-2 font-bold hover:bg-zinc-100"
                    >
                        <Printer className="w-4 h-4" />
                        <span>طباعة التقرير</span>
                    </Button>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={fetchKpiData}
                        disabled={isRefreshing}
                        className="gap-2 font-bold shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span>تحديث المؤشرات</span>
                    </Button>
                </div>
            </div>

            {/* Profit & Loss Master Banner (هل احنا بنكسب ولا بنخسر؟) */}
            <Card className={`border-2 shadow-sm overflow-hidden ${
                metrics.isProfitable 
                    ? "bg-gradient-to-l from-emerald-500/10 via-background to-background border-emerald-500/40" 
                    : "bg-gradient-to-l from-amber-500/10 via-background to-background border-amber-500/40"
            }`}>
                <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-xl">
                            <div className="flex items-center gap-2.5">
                                <Badge className={`text-xs px-3 py-1 font-bold ${
                                    metrics.isProfitable 
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                                        : "bg-amber-600 text-white"
                                }`}>
                                    {metrics.isProfitable ? "المنصة في وضع ربحي إيجابي 🟢" : "وضع تعادل / تحت التطوير 🟡"}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                    P&L Health Status
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-foreground">
                                {metrics.isProfitable 
                                    ? `صافي عائد المنصة: +${metrics.netProfit.toLocaleString()} ج.م` 
                                    : `صافي المركز المالي: ${metrics.netProfit.toLocaleString()} ج.م`}
                            </h2>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {metrics.isProfitable 
                                    ? "إيرادات عمولة المنصة الثابتة (5%) تفوق المصاريف التشغيلية المباشرة، مما يضع نموذج العمل في مرحلة استدامة ونمو مستمر."
                                    : "المنصة في مرحلة الانطلاق، وتستعد لاستقبال التدفقات النقدية مع تزايد اشتراكات الطلاب."}
                            </p>
                        </div>

                        {/* Quick Balance Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">إجمالي المبيعات (GMV):</span>
                                <span className="font-mono text-lg font-black text-foreground">
                                    {metrics.totalGmv.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">عمولة الإدارة (5%):</span>
                                <span className="font-mono text-lg font-black text-emerald-600">
                                    {metrics.totalPlatformCommission.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border col-span-2 sm:col-span-1">
                                <span className="text-[11px] text-muted-foreground block">مستحقات المدرسين (95%):</span>
                                <span className="font-mono text-lg font-black text-purple-600">
                                    {metrics.totalInstructorEarnings.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Core KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                            إجمالي المبيعات المتداولة (GMV)
                        </CardTitle>
                        <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                            <Coins className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-foreground">
                            {metrics.totalGmv.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Receipt className="w-3 h-3 text-primary" />
                            <span>من خلال {metrics.enrollmentCount} عملية التحاق</span>
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                            أرباح الإدارة الصافية (5%)
                        </CardTitle>
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600">
                            {metrics.totalPlatformCommission.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                        <p className="text-xs text-emerald-700/80 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>مضمونة ومخصومة تلقائياً</span>
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                            سيولة المحافظ في المنصة
                        </CardTitle>
                        <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-purple-600">
                            {metrics.totalInCirculation.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            طلاب: {metrics.totalStudentWalletBalances} ج.م | مدرسين: {metrics.totalInstructorWalletBalances} ج.م
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                            متوسط قيمة الطلب (AOV)
                        </CardTitle>
                        <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                            <Target className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-amber-600">
                            {metrics.aov.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            متوسط إنفاق الطالب في الكورس الواحد
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Graphs & Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Monthly Performance Chart (Bar / Curve Graph) */}
                <Card className="lg:col-span-2 border-border/60 shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <LineChart className="w-5 h-5 text-primary" />
                                    <span>حركة المبيعات الشهرية وتطور العائد (Monthly Trend)</span>
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    مقارنة حجم التداول الكلي (GMV) وعمولة المنصة خلال آخر 6 أشهر
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono">آخر 6 أشهر</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {/* Interactive Responsive SVG Bar Graph */}
                        <div className="h-64 flex items-end gap-3 sm:gap-6 pt-6 px-2 border-b">
                            {metrics.monthlyData.map((item, idx) => {
                                const heightPercent = maxMonthlyGmv > 0 
                                    ? Math.max(8, Math.round((item.gmv / maxMonthlyGmv) * 80)) 
                                    : 8

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                        {/* Tooltip on hover */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-zinc-900 text-white text-[11px] py-1.5 px-2.5 rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none">
                                            <div className="font-bold">{item.month}</div>
                                            <div>مبيعات: {item.gmv} ج.م</div>
                                            <div className="text-emerald-400">عمولة: {item.commission} ج.م</div>
                                        </div>

                                        {/* Amount label */}
                                        <span className="text-[10px] font-mono font-bold text-muted-foreground mb-1 group-hover:text-primary transition-colors">
                                            {item.gmv > 0 ? `${item.gmv}` : "0"}
                                        </span>

                                        {/* Visual Bar with Gradient */}
                                        <div
                                            style={{ height: `${heightPercent}%` }}
                                            className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-primary/80 to-primary group-hover:from-emerald-500 group-hover:to-teal-400 transition-all duration-300 shadow-sm relative overflow-hidden"
                                        >
                                            {/* Sub-bar for 5% commission indicator */}
                                            <div className="absolute bottom-0 inset-x-0 h-[15%] bg-emerald-300/40" />
                                        </div>

                                        {/* Month label */}
                                        <span className="text-xs font-bold text-muted-foreground mt-3 whitespace-nowrap">
                                            {item.month}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Chart Legend */}
                        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-primary" />
                                <span>حجم التداول الكلي (GMV)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                                <span>أرباح المنصة (5%)</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Platform Revenue Breakdown (Pie/Donut Visual) */}
                <Card className="border-border/60 shadow-sm flex flex-col justify-between">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-purple-600" />
                            <span>توزيع الإيرادات والعمولات</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            نسبة الأرباح بين المعلمين والمنصة
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {/* Circular Progress Ring Visual */}
                        <div className="flex flex-col items-center justify-center relative py-2">
                            <div className="relative w-40 h-40 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    {/* Instructor 95% Circle */}
                                    <path
                                        className="text-purple-100"
                                        strokeWidth="3.8"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    {/* Instructor 95% stroke */}
                                    <path
                                        className="text-purple-600 transition-all duration-1000"
                                        strokeDasharray="95, 100"
                                        strokeWidth="3.8"
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    {/* Platform 5% stroke */}
                                    <path
                                        className="text-emerald-500 transition-all duration-1000"
                                        strokeDasharray="5, 100"
                                        strokeDashoffset="-95"
                                        strokeWidth="4.2"
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center text-center">
                                    <span className="text-2xl font-black text-foreground">5%</span>
                                    <span className="text-[10px] font-bold text-emerald-600">عمولة المنصة</span>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Bars */}
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="flex items-center gap-1.5 text-purple-700">
                                        <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                                        <span>أرباح المعلمين (95%)</span>
                                    </span>
                                    <span className="font-mono">{metrics.totalInstructorEarnings.toLocaleString()} ج.م</span>
                                </div>
                                <Progress value={95} className="h-2 bg-purple-100 [&>div]:bg-purple-600" />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="flex items-center gap-1.5 text-emerald-700">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span>أرباح إدارة المنصة (5%)</span>
                                    </span>
                                    <span className="font-mono">{metrics.totalPlatformCommission.toLocaleString()} ج.م</span>
                                </div>
                                <Progress value={5} className="h-2 bg-emerald-100 [&>div]:bg-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/20 border-t py-3 text-[11px] text-muted-foreground flex justify-between">
                        <span>العمولة تطبق آلياً على كل عملية بيع</span>
                        <Badge variant="outline" className="text-[10px]">نظام العمولات الموحد</Badge>
                    </CardFooter>
                </Card>
            </div>

            {/* Smart Financial Advisory & Insights (نصائح مالية ذكية للإدارة) */}
            <Card className="border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-l from-amber-500/10 via-background to-background border-b pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-bold">
                                    نصائح وتوصيات الذكاء المالي للمنصة (Financial Advisory)
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    رؤى تحليلية ذكية مبنية على أرقام المبيعات الحالية لتعظيم الأرباح وإدارة السيولة
                                </CardDescription>
                            </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-xs">
                            تحليل تلقائي نشط
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {advisoryInsights.map((insight, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                                    insight.type === "positive"
                                        ? "bg-emerald-50/50 border-emerald-200"
                                        : insight.type === "warning"
                                        ? "bg-rose-50/50 border-rose-200"
                                        : "bg-blue-50/50 border-blue-200"
                                }`}
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        {insight.type === "positive" ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        ) : insight.type === "warning" ? (
                                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                        ) : (
                                            <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />
                                        )}
                                        <h4 className="font-bold text-sm text-foreground">
                                            {insight.title}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed pr-6">
                                        {insight.desc}
                                    </p>
                                </div>

                                <div className="bg-background/80 p-2.5 rounded-lg border text-xs pr-3">
                                    <span className="font-bold text-primary block mb-0.5">💡 التوصية العملية للإدارة:</span>
                                    <span className="text-muted-foreground">{insight.action}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Performance Ranking (Top Courses & Cash Flow Table) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Courses by Sales */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                <span>الكورسات الأكثر تحقيقاً للإيرادات</span>
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">أعلى المبيعات</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {metrics.topCourses.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground text-xs italic">
                                لا توجد مبيعات كورسات مسجلة في هذه الفترة بعد.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {metrics.topCourses.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                                                {i + 1}
                                            </span>
                                            <div>
                                                <h5 className="font-bold text-sm text-foreground truncate max-w-[200px]">{c.title}</h5>
                                                <span className="text-xs text-muted-foreground">{c.instructor} • {c.count} طالب</span>
                                            </div>
                                        </div>
                                        <div className="text-left font-mono">
                                            <span className="font-bold text-sm text-emerald-600 block">{c.revenue.toLocaleString()} ج.م</span>
                                            <span className="text-[10px] text-muted-foreground">عمولة المنصة: {(c.revenue * 0.05).toFixed(1)} ج.م</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Cash Flow & Liabilities Overview */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-emerald-600" />
                                <span>رصد السيولة والتدفقات النقدية (Cash Flow)</span>
                            </span>
                            <Badge variant="outline" className="text-xs">الميزانية</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="divide-y text-xs">
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-muted-foreground">إجمالي المبالغ المشحونة في المنصة:</span>
                                <span className="font-mono font-bold text-foreground">{metrics.totalRechargedAmount.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-muted-foreground">أموال مشتريات الكورسات الفعلية:</span>
                                <span className="font-mono font-bold text-emerald-600">{metrics.totalGmv.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-muted-foreground">أرباح المعلمين المسحوبة والمحولة:</span>
                                <span className="font-mono font-bold text-purple-600">{metrics.totalWithdrawalsPaid.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-muted-foreground">طلبات سحب أرباح قيد المراجعة:</span>
                                <span className="font-mono font-bold text-amber-600">{metrics.totalWithdrawalsPending.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5 bg-muted/20 px-2 rounded-lg font-bold">
                                <span>رصيد السيولة المحتفظ به داخل المنصة:</span>
                                <span className="font-mono text-primary text-sm">{metrics.totalInCirculation.toLocaleString()} ج.م</span>
                            </div>
                        </div>

                        {/* Quick Action Button */}
                        <div className="pt-2">
                            <Button asChild variant="outline" className="w-full text-xs font-bold gap-2">
                                <Link href="/admin/settlements">
                                    <span>الانتقال لجدول تسويات المحاضرين الشهري</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
