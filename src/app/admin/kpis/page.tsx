"use client"

import { useState, useEffect, useMemo } from "react"
import { db } from "@/lib/firebase/config"
import { escapeHtml } from "@/lib/escape-html"
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
import { useAdminRole } from "@/components/admin/admin-role-context"
import { PLANS, formatRate, isPlanId } from "@/lib/plans"

/* ---- GET /api/admin/finance/commissions ---- */
interface CommissionAmounts {
    sales: number
    paid: number
    grossCommission: number
    platformNet: number
    instructorShare: number
}
interface CommissionsData {
    totals: CommissionAmounts & { platformCouponCost: number }
    byPlan: (CommissionAmounts & { planId: string; rate: number })[]
    subscriptions: { total: number; count: number }
}

const EMPTY_COMMISSIONS: CommissionsData = {
    totals: { sales: 0, paid: 0, grossCommission: 0, platformCouponCost: 0, platformNet: 0, instructorShare: 0 },
    byPlan: [],
    subscriptions: { total: 0, count: 0 },
}

function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Same windows the enrollment filter uses (rolling 30/90/365 days, or everything). */
function rangeFor(timeRange: string): { from: string; to: string } {
    const now = new Date()
    const days = timeRange === "month" ? 30 : timeRange === "quarter" ? 90 : timeRange === "year" ? 365 : 0
    const from = days ? ymd(new Date(now.getTime() - days * 24 * 60 * 60 * 1000)) : "2020-01-01"
    return { from, to: ymd(now) }
}

async function fetchCommissions(from: string, to: string): Promise<CommissionsData | null> {
    try {
        const res = await fetch(`/api/admin/finance/commissions?from=${from}&to=${to}`, { cache: "no-store" })
        if (!res.ok) return null
        const json = await res.json()
        const t = json?.totals ?? {}
        const n = (v: unknown) => Number(v) || 0
        return {
            totals: {
                sales: n(t.sales), paid: n(t.paid), grossCommission: n(t.grossCommission),
                platformCouponCost: n(t.platformCouponCost), platformNet: n(t.platformNet), instructorShare: n(t.instructorShare),
            },
            byPlan: Array.isArray(json?.byPlan)
                ? json.byPlan.map((p: any) => ({
                    planId: String(p.planId), rate: n(p.rate), sales: n(p.sales), paid: n(p.paid),
                    grossCommission: n(p.grossCommission), platformNet: n(p.platformNet), instructorShare: n(p.instructorShare),
                }))
                : [],
            subscriptions: { total: n(json?.subscriptions?.total), count: n(json?.subscriptions?.count) },
        }
    } catch {
        return null
    }
}

function planLabel(planId: string): string {
    return isPlanId(planId) ? PLANS[planId].name : planId
}

/** Paid amount of one enrollment: stored sale split first, then older fields. */
function enrollmentPaid(enr: any): number {
    return Number(enr.sale_paid ?? enr.paid_amount ?? enr.price ?? 0) || 0
}

export default function AdminKpisPage() {
    const { can } = useAdminRole()
    // finance.view → full financial dashboard; analytics.view only (marketing) → non-financial numbers
    const canViewFinance = can("finance.view")
    // Enrollments are readable by admin / finance / marketing (= everyone with analytics.view)
    const canReadEnrollments = canViewFinance || can("analytics.view")
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [timeRange, setTimeRange] = useState("all") // "month", "quarter", "year", "all"

    // Raw data
    const [enrollments, setEnrollments] = useState<any[]>([])
    const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([])
    const [walletRequests, setWalletRequests] = useState<any[]>([])
    const [profiles, setProfiles] = useState<any[]>([])
    const [courses, setCourses] = useState<any[]>([])
    // Finance numbers (finance.view only): per-sale stored split, aggregated server-side
    const [commissions, setCommissions] = useState<CommissionsData>(EMPTY_COMMISSIONS)
    const [monthlyFinance, setMonthlyFinance] = useState<(CommissionsData | null)[]>([])
    const [financeError, setFinanceError] = useState(false)

    useEffect(() => {
        fetchKpiData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!canViewFinance) return
        let cancelled = false
        const { from, to } = rangeFor(timeRange)
        fetchCommissions(from, to).then((data) => {
            if (cancelled) return
            setCommissions(data ?? EMPTY_COMMISSIONS)
            setFinanceError(!data)
        })
        return () => {
            cancelled = true
        }
    }, [canViewFinance, timeRange])

    /** Last 6 calendar months, one commissions call each (for the monthly trend chart). */
    async function fetchMonthlyFinance() {
        if (!canViewFinance) return
        const now = new Date()
        const calls = []
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
            calls.push(fetchCommissions(ymd(start), ymd(end)))
        }
        setMonthlyFinance(await Promise.all(calls))
    }

    async function fetchKpiData() {
        setIsRefreshing(true)
        try {
            if (canViewFinance) {
                const { from, to } = rangeFor(timeRange)
                const [current] = await Promise.all([fetchCommissions(from, to), fetchMonthlyFinance()])
                setCommissions(current ?? EMPTY_COMMISSIONS)
                setFinanceError(!current)
            }
            // Each query is independent: a denied/failed one resolves to [] and never breaks the others.
            const fetchList = async (name: string, enabled: boolean): Promise<any[]> => {
                if (!enabled) return []
                try {
                    const snap = await getDocs(collection(db, name))
                    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
                } catch (err) {
                    console.warn(`KPIs: could not load ${name}`, err)
                    return []
                }
            }

            // Money collections are only queried for roles that can see finance
            const [enrList, withList, walList, profList, coursesList] = await Promise.all([
                fetchList("enrollments", canReadEnrollments),
                fetchList("withdrawal_requests", canViewFinance),
                fetchList("wallet_requests", canViewFinance),
                fetchList("profiles", true),
                fetchList("courses", true),
            ])

            setEnrollments(enrList)
            setWithdrawalRequests(withList)
            setWalletRequests(walList)
            let usersList: any[] = []
            // The users API (merged with wallet balances) is only needed for the financial view
            if (canViewFinance) {
                try {
                    const uRes = await fetch("/api/admin/users")
                    if (uRes.ok) {
                        const uData = await uRes.json()
                        usersList = uData.users || []
                    }
                } catch {}
            }
            if (!usersList.length) {
                usersList = profList
            }
            setProfiles(usersList)
            setCourses(coursesList)
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
        // Finance totals come from the commissions API (sum of the per-sale stored split:
        // platform_net / instructor_share at the plan rate of each sale) — never price × a fixed rate.
        const t = commissions.totals
        const totalGmv = canViewFinance ? t.paid : filteredEnrollments.reduce((s, e) => s + enrollmentPaid(e), 0)
        const totalPlatformNet = t.platformNet
        const totalGrossCommission = t.grossCommission
        const totalPlatformCouponCost = t.platformCouponCost
        const totalInstructorEarnings = t.instructorShare
        const subscriptionRevenue = commissions.subscriptions.total
        const subscriptionCount = commissions.subscriptions.count
        const salesCount = canViewFinance ? t.sales : filteredEnrollments.length
        const revenueByPlan = commissions.byPlan

        // Total Recharged Money into Platform Wallets (Approved Manual)
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

        // Operational Costs estimate (e.g. Bunny stream/storage, Hosting)
        // Typically around 1.5% - 2.5% or fixed monthly estimate ~250 EGP
        const estimatedHostingCosts = Math.max(150, totalGmv * 0.015)
        
        // P&L: Net Profit = platform net from sales + plan subscriptions - Estimated Costs
        const platformRevenue = totalPlatformNet + subscriptionRevenue
        const netProfit = platformRevenue - estimatedHostingCosts
        const isProfitable = netProfit >= 0
        const profitMargin = totalGmv > 0 ? ((netProfit / totalGmv) * 100) : 0

        // Average Order Value (AOV)
        const aov = salesCount > 0 ? Math.round(totalGmv / salesCount) : 0

        // Wallet Utilization Rate: How much of recharged money was actually spent on courses
        const walletUtilization = totalRechargedAmount > 0 
            ? Math.min(100, Math.round((totalGmv / totalRechargedAmount) * 100))
            : 0

        // Course Breakdown (Top 5 Performing Courses)
        const courseSalesMap: Record<string, { title: string; count: number; revenue: number; platformNet: number; instructor: string }> = {}
        filteredEnrollments.forEach(enr => {
            const cId = enr.course_id || "unknown"
            if (!courseSalesMap[cId]) {
                courseSalesMap[cId] = {
                    title: enr.course_title || "كورس بدون عنوان",
                    count: 0,
                    revenue: 0,
                    platformNet: 0,
                    instructor: enr.instructor_name || "محاضر",
                }
            }
            courseSalesMap[cId].count++
            if (canViewFinance) {
                courseSalesMap[cId].revenue += enrollmentPaid(enr)
                // stored per sale at the plan rate of that sale
                courseSalesMap[cId].platformNet += Number(enr.sale_platform_net) || 0
            }
        })

        const topCourses = Object.values(courseSalesMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        // Non-financial ranking (by number of enrollments) for roles without finance.view
        const topCoursesByCount = Object.values(courseSalesMap)
            .sort((a, b) => b.count - a.count)
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

            let monthEnrollments = 0

            enrollments.forEach(enr => {
                const enrDate = new Date(enr.enrolled_at || enr.created_at || 0)
                if (enrDate.getMonth() === mIdx && enrDate.getFullYear() === y) {
                    monthEnrollments++
                }
            })

            const mf = monthlyFinance[5 - i]
            monthlyData.push({
                month: label,
                gmv: Math.round(mf?.totals.paid ?? 0),
                commission: Math.round(mf?.totals.platformNet ?? 0),
                enrollments: monthEnrollments,
            })
        }

        return {
            totalGmv,
            totalPlatformNet,
            totalGrossCommission,
            totalPlatformCouponCost,
            totalInstructorEarnings,
            subscriptionRevenue,
            subscriptionCount,
            platformRevenue,
            revenueByPlan,
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
            salesCount,
            studentCount,
            instructorCount,
            totalCourses: courses.length,
            topCourses,
            topCoursesByCount,
            monthlyData,
        }
    }, [enrollments, walletRequests, withdrawalRequests, profiles, courses, timeRange, commissions, monthlyFinance, canViewFinance])

    // Dynamic AI & Financial Advisory Insights
    const advisoryInsights = useMemo(() => {
        const insights: { type: "positive" | "warning" | "opportunity"; title: string; desc: string; action: string }[] = []

        // 1. Profitability Evaluation
        if (metrics.isProfitable && metrics.totalGmv > 0) {
            insights.push({
                type: "positive",
                title: "المنصة في نطاق الربحية الإيجابية (Profitable)",
                desc: `إيراد المنصة (صافي المبيعات ${metrics.totalPlatformNet.toLocaleString()} ج.م + اشتراكات الباقات ${metrics.subscriptionRevenue.toLocaleString()} ج.م) يغطي تكاليف التشغيل التقديرية (${metrics.estimatedHostingCosts.toLocaleString()} ج.م) مع فائض صافي قدره ${metrics.netProfit.toLocaleString()} ج.م.`,
                action: "شجّع المدرسين النشطين على الترقية لباقات المحترف والنخبة (اشتراك شهري ثابت) مع التركيز على زيادة عدد الطلاب النشطين.",
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

        return insights
    }, [metrics])

    // Find max value in monthly graph for proper SVG scaling
    const maxMonthlyGmv = Math.max(...metrics.monthlyData.map(m => m.gmv), 100)
    const maxMonthlyEnrollments = Math.max(...metrics.monthlyData.map(m => m.enrollments), 1)

    function handlePrint() {
        const windowUrl = 'about:blank';
        const uniqueName = new Date().getTime();
        const windowName = 'FinanceKpiReport_' + uniqueName;
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (!printWindow) {
            alert("يرجى تفعيل السماح بالنوافذ المنبثقة (Popups) لتصدير تقرير المؤشرات كـ PDF");
            return;
        }

        const timeLabel = timeRange === "month" ? "آخر 30 يوم"
            : timeRange === "quarter" ? "آخر 3 شهور"
            : timeRange === "year" ? "العام الحالي"
            : "كامل الفترة (تاريخي)";

        const printDate = new Date().toLocaleDateString("ar-EG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
                <head>
                    <meta charset="utf-8">
                    <title>التقرير المالي التنفيذي ومؤشرات الأداء - أكاديمية المنارة</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm 15mm; }
                        * { box-sizing: border-box; }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            direction: rtl;
                            background: #ffffff;
                            color: #0f172a;
                            margin: 0;
                            padding: 20px;
                            font-size: 13px;
                            line-height: 1.5;
                        }
                        .report-container {
                            border: 2px solid #e2e8f0;
                            border-radius: 16px;
                            padding: 24px;
                            max-width: 900px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 16px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 22px;
                            font-weight: 900;
                            color: #0f172a;
                        }
                        .header p {
                            margin: 4px 0 0;
                            color: #64748b;
                            font-size: 12px;
                            font-weight: 600;
                        }
                        .meta-strip {
                            background: #f8fafc;
                            border: 1px solid #cbd5e1;
                            border-radius: 10px;
                            padding: 10px 16px;
                            display: flex;
                            justify-content: space-between;
                            font-size: 12px;
                            margin-bottom: 20px;
                        }
                        .kpi-grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 12px;
                            margin-bottom: 24px;
                        }
                        .kpi-card {
                            border: 1px solid #cbd5e1;
                            background: #ffffff;
                            border-radius: 12px;
                            padding: 14px;
                            text-align: center;
                        }
                        .kpi-card .val {
                            font-size: 20px;
                            font-weight: 900;
                            color: #0f172a;
                            margin-bottom: 2px;
                        }
                        .kpi-card .lbl {
                            font-size: 11px;
                            font-weight: 700;
                            color: #64748b;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 10px;
                            font-size: 12px;
                        }
                        th {
                            background: #f1f5f9;
                            color: #334155;
                            font-weight: 800;
                            text-align: right;
                            padding: 9px 12px;
                            border-bottom: 2px solid #cbd5e1;
                        }
                        td {
                            padding: 9px 12px;
                            border-bottom: 1px solid #e2e8f0;
                            color: #1e293b;
                        }
                        tr:nth-child(even) td { background: #fafafa; }
                        .section-title {
                            font-size: 14px;
                            font-weight: 800;
                            color: #0f172a;
                            margin: 22px 0 8px;
                            border-bottom: 1px solid #e2e8f0;
                            padding-bottom: 6px;
                        }
                        .footer {
                            margin-top: 35px;
                            padding-top: 16px;
                            border-top: 1px dashed #cbd5e1;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            font-size: 12px;
                        }
                        .stamp-block {
                            text-align: center;
                            min-width: 170px;
                        }
                        .stamp-box {
                            height: 60px;
                            border-bottom: 1px solid #94a3b8;
                            margin-bottom: 6px;
                        }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <div>
                                <h1>أكاديمية المنارة التعليمية</h1>
                                <p>التقرير المالي التنفيذي وتحليل مؤشرات الأداء (Finance & KPIs)</p>
                            </div>
                            <div style="text-align: left; font-size: 11px; color: #64748b;">
                                <div><strong>تاريخ الاستخراج:</strong> ${printDate}</div>
                                <div><strong>إعداد:</strong> إدارة التحليل المالي والرقابة</div>
                            </div>
                        </div>

                        <div class="meta-strip">
                            <div><strong>الفترة المحددة بالتقرير:</strong> ${timeLabel}</div>
                            <div><strong>إجمالي العمليات الموثقة:</strong> ${escapeHtml(metrics.enrollmentCount || 0)} عملية اشتراك</div>
                        </div>

                        <div class="kpi-grid">
                            <div class="kpi-card">
                                <div class="val" style="color: #2563eb;">${escapeHtml((metrics.totalGmv || 0).toLocaleString())} ج.م</div>
                                <div class="lbl">إجمالي حجم التداول (GMV)</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: #16a34a;">${escapeHtml((metrics.totalPlatformNet || 0).toLocaleString())} ج.م</div>
                                <div class="lbl">صافي المنصة من المبيعات (بعد كوبونات المنصة)</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: #7c3aed;">${escapeHtml((metrics.totalInstructorEarnings || 0).toLocaleString())} ج.م</div>
                                <div class="lbl">مستحقات المحاضرين</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: #0891b2;">${escapeHtml((metrics.subscriptionRevenue || 0).toLocaleString())} ج.م</div>
                                <div class="lbl">إيرادات اشتراكات الباقات (${escapeHtml(metrics.subscriptionCount || 0)})</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val">${escapeHtml(metrics.salesCount || 0)}</div>
                                <div class="lbl">عدد عمليات البيع</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: #ea580c;">${(metrics.totalWithdrawalsPaid || 0).toLocaleString()} ج.م</div>
                                <div class="lbl">المبالغ المسحوبة للمدرسين</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val">${(metrics.aov || 0).toLocaleString()} ج.م</div>
                                <div class="lbl">متوسط قيمة العملية (AOV)</div>
                            </div>
                        </div>

                        <div class="section-title">الإيراد حسب الباقة</div>
                        <table>
                            <thead>
                                <tr><th>الباقة</th><th>العمولة</th><th>المبيعات</th><th>المدفوع</th><th>صافي المنصة</th><th>نصيب المدرسين</th></tr>
                            </thead>
                            <tbody>
                                ${(metrics.revenueByPlan || []).length === 0 ? `<tr><td colspan="6" style="text-align:center; color:#64748b;">—</td></tr>` : metrics.revenueByPlan.map((p) => `
                                    <tr>
                                        <td style="font-weight: 800;">${escapeHtml(planLabel(p.planId))}</td>
                                        <td>${escapeHtml(formatRate(p.rate))}</td>
                                        <td>${escapeHtml(p.sales)}</td>
                                        <td>${escapeHtml(p.paid.toLocaleString())} ج.م</td>
                                        <td style="color:#16a34a; font-weight:800;">${escapeHtml(p.platformNet.toLocaleString())} ج.م</td>
                                        <td>${escapeHtml(p.instructorShare.toLocaleString())} ج.م</td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>

                        <div class="section-title">الكورسات الأعلى مبيعاً وتدفقاً مالياً بالفترة</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>الكورس</th>
                                    <th>المحاضر</th>
                                    <th>المبيعات</th>
                                    <th>إجمالي الإيرادات</th>
                                    <th>صافي المنصة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(metrics.topCourses || []).length === 0 ? `
                                    <tr>
                                        <td colspan="5" style="text-align:center; padding: 20px; color: #64748b;">لا توجد مبيعات مسجلة في هذه الفترة</td>
                                    </tr>
                                ` : (metrics.topCourses || []).slice(0, 8).map((c: any) => `
                                    <tr>
                                        <td style="font-weight: 800;">${escapeHtml(c.title)}</td>
                                        <td>${escapeHtml(c.instructor || 'مدرس المادة')}</td>
                                        <td>${escapeHtml(c.count)} طالب</td>
                                        <td style="color: #2563eb; font-weight: 800;">${escapeHtml((c.revenue || 0).toLocaleString())} ج.م</td>
                                        <td style="color: #16a34a; font-weight: 800;">${escapeHtml(Math.round(c.platformNet || 0).toLocaleString())} ج.م</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div class="footer">
                            <div>
                                <p style="margin: 0; font-weight: 700;">أكاديمية المنارة للتعليم الإلكتروني © 2026</p>
                                <p style="margin: 2px 0 0; color: #64748b; font-size: 11px;">مستند رقابي مالي معتمد موجّه للإدارة العامة ومجلس الإدارة.</p>
                            </div>
                            <div class="stamp-block">
                                <div class="stamp-box"></div>
                                <div>توقيع المدير المالي التنفيذي</div>
                            </div>
                            <div class="stamp-block">
                                <div class="stamp-box"></div>
                                <div>اعتماد الرئيس التنفيذي / الختم</div>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
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
                        <span>{canViewFinance ? "المؤشرات المالية ولوحة الأداء (Finance & KPIs)" : "مؤشرات الأداء (KPIs)"}</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {canViewFinance
                            ? "تحليل حجم التداول، صافي إيراد المنصة (عمولة كل عملية بيع بنسبة باقة المدرس وقتها) واشتراكات الباقات، والتدفقات النقدية."
                            : "متابعة أعداد الاشتراكات، نمو الطلاب والمعلمين، والكورسات الأكثر إقبالاً."}
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

                    {canViewFinance && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="gap-2 font-bold hover:bg-zinc-100"
                        >
                            <Printer className="w-4 h-4" />
                            <span>طباعة التقرير</span>
                        </Button>
                    )}

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
            {canViewFinance && (
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
                                    ? "صافي المنصة من المبيعات (بعد تكلفة كوبونات المنصة) + إيرادات اشتراكات الباقات يفوق المصاريف التشغيلية التقديرية."
                                    : "المنصة في مرحلة الانطلاق، وتستعد لاستقبال التدفقات النقدية مع تزايد اشتراكات الطلاب."}
                            </p>
                        </div>

                        {/* Quick Balance Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">المدفوع من الطلاب (GMV):</span>
                                <span className="font-mono text-lg font-black text-foreground">
                                    {metrics.totalGmv.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">صافي المنصة من المبيعات:</span>
                                <span className={`font-mono text-lg font-black ${metrics.totalPlatformNet < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                    {metrics.totalPlatformNet.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">اشتراكات الباقات:</span>
                                <span className="font-mono text-lg font-black text-cyan-600">
                                    {metrics.subscriptionRevenue.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                            <div className="bg-background/80 backdrop-blur p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">مستحقات المدرسين:</span>
                                <span className="font-mono text-lg font-black text-purple-600">
                                    {metrics.totalInstructorEarnings.toLocaleString()} <span className="text-xs text-muted-foreground">ج.م</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            )}

            {/* Non-financial KPI cards (roles without finance.view) */}
            {!canViewFinance && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SimpleKpiCard
                        title="إجمالي الاشتراكات"
                        value={metrics.enrollmentCount}
                        subtitle="عمليات التحاق خلال الفترة المحددة"
                        icon={<Receipt className="h-4 w-4" />}
                        color="bg-blue-500/10 text-blue-600"
                    />
                    <SimpleKpiCard
                        title="الطلاب المسجلون"
                        value={metrics.studentCount}
                        subtitle="إجمالي حسابات الطلاب"
                        icon={<Users className="h-4 w-4" />}
                        color="bg-emerald-500/10 text-emerald-600"
                    />
                    <SimpleKpiCard
                        title="المعلمون"
                        value={metrics.instructorCount}
                        subtitle="إجمالي حسابات المحاضرين"
                        icon={<Layers className="h-4 w-4" />}
                        color="bg-purple-500/10 text-purple-600"
                    />
                    <SimpleKpiCard
                        title="الكورسات على المنصة"
                        value={metrics.totalCourses}
                        subtitle="جميع الكورسات المضافة"
                        icon={<BookOpen className="h-4 w-4" />}
                        color="bg-amber-500/10 text-amber-600"
                    />
                </div>
            )}

            {/* Core KPI Stat Cards */}
            {canViewFinance && (
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
                            <span>من خلال {metrics.salesCount} عملية بيع</span>
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                            إيراد المنصة (صافي + اشتراكات)
                        </CardTitle>
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600">
                            {metrics.platformRevenue.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>
                                عمولة {metrics.totalGrossCommission.toLocaleString()} − كوبونات المنصة {metrics.totalPlatformCouponCost.toLocaleString()} + اشتراكات {metrics.subscriptionRevenue.toLocaleString()}
                            </span>
                        </p>
                        {financeError && <p className="text-[11px] text-red-600 mt-1">تعذر تحميل بيانات العمولات</p>}
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
            )}

            {/* Graphs & Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Monthly Performance Chart (Bar / Curve Graph) */}
                <Card className={`${canViewFinance ? "lg:col-span-2" : "lg:col-span-3"} border-border/60 shadow-sm`}>
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <LineChart className="w-5 h-5 text-primary" />
                                    <span>{canViewFinance ? "حركة المبيعات الشهرية وتطور العائد (Monthly Trend)" : "حركة الاشتراكات الشهرية (Monthly Trend)"}</span>
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    {canViewFinance
                                        ? "مقارنة المدفوع من الطلاب (GMV) وصافي المنصة خلال آخر 6 أشهر"
                                        : "عدد عمليات الالتحاق بالكورسات خلال آخر 6 أشهر"}
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono">آخر 6 أشهر</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {/* Interactive Responsive SVG Bar Graph */}
                        <div className="h-64 flex items-end gap-3 sm:gap-6 pt-6 px-2 border-b">
                            {metrics.monthlyData.map((item, idx) => {
                                const barValue = canViewFinance ? item.gmv : item.enrollments
                                const barMax = canViewFinance ? maxMonthlyGmv : maxMonthlyEnrollments
                                const heightPercent = barMax > 0
                                    ? Math.max(8, Math.round((barValue / barMax) * 80))
                                    : 8

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                        {/* Tooltip on hover */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-zinc-900 text-white text-[11px] py-1.5 px-2.5 rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none">
                                            <div className="font-bold">{item.month}</div>
                                            {canViewFinance ? (
                                                <>
                                                    <div>مبيعات: {item.gmv} ج.م</div>
                                                    <div className="text-emerald-400">صافي المنصة: {item.commission} ج.م</div>
                                                </>
                                            ) : (
                                                <div>اشتراكات: {item.enrollments}</div>
                                            )}
                                        </div>

                                        {/* Amount label */}
                                        <span className="text-[10px] font-mono font-bold text-muted-foreground mb-1 group-hover:text-primary transition-colors">
                                            {barValue > 0 ? `${barValue}` : "0"}
                                        </span>

                                        {/* Visual Bar with Gradient */}
                                        <div
                                            style={{ height: `${heightPercent}%` }}
                                            className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-primary/80 to-primary group-hover:from-emerald-500 group-hover:to-teal-400 transition-all duration-300 shadow-sm relative overflow-hidden"
                                        >
                                            {/* Sub-bar: platform net share of that month's sales */}
                                            {canViewFinance && item.gmv > 0 && item.commission > 0 && (
                                                <div
                                                    className="absolute bottom-0 inset-x-0 bg-emerald-300/60"
                                                    style={{ height: `${Math.min(100, Math.round((item.commission / item.gmv) * 100))}%` }}
                                                />
                                            )}
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
                            {canViewFinance ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm bg-primary" />
                                        <span>حجم التداول الكلي (GMV)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                                        <span>صافي المنصة</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-primary" />
                                    <span>عدد الاشتراكات</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Platform Revenue Breakdown (Pie/Donut Visual) */}
                {canViewFinance && (
                <Card className="border-border/60 shadow-sm flex flex-col justify-between">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-purple-600" />
                            <span>الإيراد حسب الباقة</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            كل عملية بيع محسوبة بنسبة باقة المدرس وقت البيع
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {metrics.revenueByPlan.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">لا توجد مبيعات في هذه الفترة</p>
                        ) : (
                            metrics.revenueByPlan.map((p) => {
                                const share = metrics.totalGmv > 0 ? Math.round((p.paid / metrics.totalGmv) * 100) : 0
                                return (
                                    <div key={`${p.planId}-${p.rate}`}>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="flex items-center gap-1.5">
                                                <span>{planLabel(p.planId)}</span>
                                                <Badge variant="outline" className="text-[10px]">{formatRate(p.rate)}</Badge>
                                            </span>
                                            <span className={`font-mono ${p.platformNet < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                {p.platformNet.toLocaleString()} ج.م
                                            </span>
                                        </div>
                                        <Progress value={share} className="h-2 bg-emerald-100 [&>div]:bg-emerald-500" />
                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                            {p.sales} عملية • مدفوع {p.paid.toLocaleString()} ج.م • للمدرسين {p.instructorShare.toLocaleString()} ج.م
                                        </p>
                                    </div>
                                )
                            })
                        )}

                        <div className="space-y-1.5 border-t pt-3 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">إجمالي العمولة</span>
                                <span className="font-mono font-bold">{metrics.totalGrossCommission.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">تكلفة كوبونات المنصة</span>
                                <span className="font-mono font-bold text-red-600">-{metrics.totalPlatformCouponCost.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">صافي المنصة من المبيعات</span>
                                <span className="font-mono font-bold text-emerald-600">{metrics.totalPlatformNet.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">اشتراكات الباقات ({metrics.subscriptionCount})</span>
                                <span className="font-mono font-bold text-cyan-600">{metrics.subscriptionRevenue.toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/20 border-t py-3 text-[11px] text-muted-foreground flex justify-between">
                        <span>البداية {formatRate(PLANS.starter.commissionRate)} • المحترف {formatRate(PLANS.pro.commissionRate)} • النخبة {formatRate(PLANS.center.commissionRate)}</span>
                        <Badge variant="outline" className="text-[10px]">عمولة حسب الباقة</Badge>
                    </CardFooter>
                </Card>
                )}
            </div>

            {/* Smart Financial Advisory & Insights (نصائح مالية ذكية للإدارة) */}
            {canViewFinance && (
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
            )}

            {/* Performance Ranking (Top Courses & Cash Flow Table) */}
            <div className={`grid grid-cols-1 gap-6 ${canViewFinance ? "lg:grid-cols-2" : ""}`}>
                {/* Top Courses by Sales */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                <span>{canViewFinance ? "الكورسات الأكثر تحقيقاً للإيرادات" : "الكورسات الأكثر اشتراكاً"}</span>
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">{canViewFinance ? "أعلى المبيعات" : "أعلى الاشتراكات"}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {(canViewFinance ? metrics.topCourses : metrics.topCoursesByCount).length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground text-xs italic">
                                {canViewFinance ? "لا توجد مبيعات كورسات مسجلة في هذه الفترة بعد." : "لا توجد اشتراكات مسجلة في هذه الفترة بعد."}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(canViewFinance ? metrics.topCourses : metrics.topCoursesByCount).map((c, i) => (
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
                                        {canViewFinance ? (
                                            <div className="text-left font-mono">
                                                <span className="font-bold text-sm text-emerald-600 block">{c.revenue.toLocaleString()} ج.م</span>
                                                <span className="text-[10px] text-muted-foreground">صافي المنصة: {c.platformNet.toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</span>
                                            </div>
                                        ) : (
                                            <div className="text-left font-mono">
                                                <span className="font-bold text-sm text-primary block">{c.count} اشتراك</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Cash Flow & Liabilities Overview */}
                {canViewFinance && (
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
                )}
            </div>
        </div>
    )
}

function SimpleKpiCard({ title, value, subtitle, icon, color }: { title: string; value: number; subtitle: string; icon: React.ReactNode; color: string }) {
    return (
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                    {title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${color}`}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-foreground">{value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </CardContent>
        </Card>
    )
}
