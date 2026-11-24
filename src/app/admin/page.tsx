"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Users,
    BookOpen,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    Clock,
    DollarSign,
    BarChart3,
    Activity,
    Wallet,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    Coins
} from "lucide-react"
import Link from "next/link"
import { useAdminRole } from "@/components/admin/admin-role-context"
import { PLANS, formatRate, isPlanId } from "@/lib/plans"

interface PlanRevenueRow {
    planId: string
    rate: number
    sales: number
    paid: number
    grossCommission: number
    platformNet: number
    instructorShare: number
}

interface FinanceSummary {
    paid: number
    sales: number
    platformNet: number
    platformCouponCost: number
    instructorShare: number
    subscriptionsTotal: number
    subscriptionsCount: number
    byPlan: PlanRevenueRow[]
}

function todayYmd(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** All-time finance summary from the per-sale stored split (sum of platform_net, never price × rate). */
async function fetchFinanceSummary(): Promise<FinanceSummary | null> {
    try {
        const res = await fetch(`/api/admin/finance/commissions?from=2020-01-01&to=${todayYmd()}`, { cache: "no-store" })
        if (!res.ok) return null
        const json = await res.json()
        const t = json?.totals ?? {}
        return {
            paid: Number(t.paid) || 0,
            sales: Number(t.sales) || 0,
            platformNet: Number(t.platformNet) || 0,
            platformCouponCost: Number(t.platformCouponCost) || 0,
            instructorShare: Number(t.instructorShare) || 0,
            subscriptionsTotal: Number(json?.subscriptions?.total) || 0,
            subscriptionsCount: Number(json?.subscriptions?.count) || 0,
            byPlan: Array.isArray(json?.byPlan) ? json.byPlan : [],
        }
    } catch {
        return null
    }
}

function egp(n: number): string {
    return `${(Number(n) || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`
}

export default function AdminDashboard() {
    const { can } = useAdminRole()
    const canViewFinance = can("finance.view")
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalCourses: 0,
        pendingCourses: 0,
        approvedCourses: 0,
        totalStudents: 0,
        totalInstructors: 0,
    })
    const [finance, setFinance] = useState<FinanceSummary | null>(null)
    const [recentCourses, setRecentCourses] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchAdminStats() {
            try {
                // Money figures come only from the commissions API, and only for roles with finance.view
                const [usersSnap, coursesSnap, financeSummary] = await Promise.all([
                    getDocs(collection(db, "profiles")),
                    getDocs(collection(db, "courses")),
                    canViewFinance ? fetchFinanceSummary() : Promise.resolve(null),
                ])

                const profiles = usersSnap.docs.map((doc: any) => doc.data())
                const courses = coursesSnap.docs.map((doc: any) => doc.data())

                const pending = courses.filter((c: any) => c.status === 'pending').length
                const approved = courses.filter((c: any) => c.status === 'approved').length
                const students = profiles.filter((p: any) => p.role === 'student' || !p.role).length
                const instructors = profiles.filter((p: any) => p.role === 'instructor').length

                setFinance(financeSummary)
                setStats({
                    totalUsers: usersSnap.size,
                    totalCourses: coursesSnap.size,
                    pendingCourses: pending,
                    approvedCourses: approved,
                    totalStudents: students,
                    totalInstructors: instructors,
                })

                // Get 5 most recent courses
                const recentQ = query(collection(db, "courses"), orderBy("created_at", "desc"), limit(5))
                try {
                    const recentSnap = await getDocs(recentQ)
                    setRecentCourses(recentSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })))
                } catch (e) {
                    // fallback without orderBy if index building
                    const recentSnap = await getDocs(query(collection(db, "courses"), limit(5)))
                    setRecentCourses(recentSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })))
                }

            } catch (error) {
                console.error("Error fetching admin stats:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchAdminStats()
    }, [canViewFinance])

    const hasQuickLinks = can("analytics.view") || can("logs.view") || can("payments.manage") || can("withdrawals.manage")

    return (
        <div className="space-y-8 font-arabic">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-primary/10 text-primary rounded-xl">🛡️</span>
                        <span>لوحة التحكم الرئيسية للمسؤول</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        نظرة شاملة على النشاط المالي، العمليات الجارية، وحالة منصة أكاديمية المنارة.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    {can("logs.view") && (
                        <Button asChild variant="outline" size="sm" className="gap-2 font-bold">
                            <Link href="/admin/logs">
                                <Activity className="w-4 h-4 text-primary" />
                                <span>سجل النشاطات (Logs)</span>
                            </Link>
                        </Button>
                    )}
                    {can("analytics.view") && (
                        <Button asChild variant="default" size="sm" className="gap-2 font-bold shadow-sm">
                            <Link href="/admin/kpis">
                                <BarChart3 className="w-4 h-4" />
                                <span>{canViewFinance ? "المؤشرات المالية (KPIs)" : "مؤشرات الأداء (KPIs)"}</span>
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {/* Financial Health Banner (P&L Status) */}
            {canViewFinance && (
            <Card className="border-2 border-emerald-500/30 bg-gradient-to-l from-emerald-500/10 via-background to-background shadow-sm overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="space-y-1.5 max-w-xl">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5">
                                    المؤشرات المالية (منذ البداية)
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    عمولة حسب الباقة: {formatRate(PLANS.starter.commissionRate)} / {formatRate(PLANS.pro.commissionRate)} / {formatRate(PLANS.center.commissionRate)}
                                </span>
                            </div>
                            <h3 className="text-xl font-black text-foreground">
                                صافي ربح المنصة من المبيعات + اشتراكات الباقات
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                صافي المنصة = مجموع العمولة المسجلة على كل عملية بيع بنسبة باقة المدرس وقتها، بعد خصم تكلفة كوبونات المنصة. إيرادات الاشتراكات معروضة منفصلة.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-3 w-full lg:w-auto">
                            <div className="bg-background/80 p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">المدفوع من الطلاب:</span>
                                <span className="text-lg font-black text-foreground">{finance ? egp(finance.paid) : "—"}</span>
                            </div>
                            <div className="bg-background/80 p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">صافي المنصة من المبيعات:</span>
                                <span className={`text-lg font-black ${finance && finance.platformNet < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                    {finance ? egp(finance.platformNet) : "—"}
                                </span>
                            </div>
                            <div className="bg-background/80 p-3.5 rounded-xl border">
                                <span className="text-[11px] text-muted-foreground block">إيرادات اشتراكات الباقات:</span>
                                <span className="text-lg font-black text-blue-600">{finance ? egp(finance.subscriptionsTotal) : "—"}</span>
                            </div>
                            <Button asChild size="icon" variant="outline" className="h-12 w-12 shrink-0 rounded-xl hover:bg-primary hover:text-white">
                                <Link href="/admin/kpis" title="عرض التحليل المالي الكامل">
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {finance && finance.byPlan.length > 0 && (
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            {finance.byPlan.map((p) => (
                                <div key={`${p.planId}-${p.rate}`} className="rounded-xl border bg-background/80 p-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold">{isPlanId(p.planId) ? PLANS[p.planId].name : p.planId}</span>
                                        <Badge variant="secondary" className="text-[10px]">{formatRate(Number(p.rate) || 0)}</Badge>
                                    </div>
                                    <div className={`mt-1 text-base font-black ${p.platformNet < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                        {egp(p.platformNet)}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {(Number(p.sales) || 0).toLocaleString("ar-EG")} عملية بيع • مدفوع {egp(p.paid)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {/* Quick Stats Grid */}
            <div className={`grid gap-4 sm:grid-cols-2 ${canViewFinance ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                <StatCard
                    title="إجمالي المستخدمين"
                    value={stats.totalUsers.toString()}
                    subtitle={`${stats.totalStudents} طالب • ${stats.totalInstructors} مدرس`}
                    icon={<Users className="h-5 w-5" />}
                    color="text-blue-600 bg-blue-500/10"
                />
                <StatCard
                    title="الكورسات المنشورة"
                    value={stats.approvedCourses.toString()}
                    subtitle={`من إجمالي ${stats.totalCourses} كورس`}
                    icon={<BookOpen className="h-5 w-5" />}
                    color="text-emerald-600 bg-emerald-500/10"
                />
                <StatCard
                    title="كورسات بانتظار الاعتماد"
                    value={stats.pendingCourses.toString()}
                    subtitle={stats.pendingCourses > 0 ? "تتطلب مراجعة وقرار" : "جميع الكورسات معتمدة"}
                    icon={<AlertCircle className="h-5 w-5" />}
                    color={stats.pendingCourses > 0 ? "text-amber-600 bg-amber-500/10" : "text-muted-foreground bg-muted"}
                />
                {canViewFinance && (
                    <StatCard
                        title="حجم التداول (GMV)"
                        value={finance ? egp(finance.paid) : "—"}
                        subtitle={finance ? `صافي المنصة: ${egp(finance.platformNet)} • اشتراكات: ${egp(finance.subscriptionsTotal)}` : isLoading ? "جاري التحميل..." : "تعذر تحميل البيانات المالية"}
                        icon={<Coins className="h-5 w-5" />}
                        color="text-purple-600 bg-purple-500/10"
                    />
                )}
            </div>

            {/* Two Column Layout */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Courses */}
                <Card className="col-span-4 border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" />
                            <span>أحدث الكورسات المضافة</span>
                        </CardTitle>
                        <Button asChild variant="ghost" size="sm" className="text-xs">
                            <Link href="/admin/all-courses">عرض الكل</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="space-y-4">
                            {recentCourses.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-8">لا توجد كورسات مضافة حديثاً.</p>
                            ) : (
                                recentCourses.map((course) => (
                                    <div key={course.id} className="flex items-center justify-between border-b pb-3.5 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3.5">
                                            <div className="h-10 w-16 rounded-lg bg-muted overflow-hidden shrink-0 border">
                                                <img
                                                    src={course.thumbnail_url || course.thumbnail || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"}
                                                    alt={course.title}
                                                    className="object-cover w-full h-full"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-foreground line-clamp-1">{course.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {course.instructor_name} • {course.price ? `${course.price} ج.م` : "مجاني"}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={course.status === 'approved' ? 'default' : 'secondary'}
                                            className={`text-[10px] shrink-0 font-bold ${course.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'}`}
                                        >
                                            {course.status === 'approved' ? 'منشور' : 'بانتظار المراجعة'}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Shortcuts & Alerts */}
                <div className="col-span-3 space-y-4">
                    {hasQuickLinks && (
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                <span>لوحة الإجراءات السريعة</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            {can("analytics.view") && (
                            <Link
                                href="/admin/kpis"
                                className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between block group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                            {canViewFinance ? "تحليل المؤشرات المالية (KPIs)" : "تحليل مؤشرات الأداء (KPIs)"}
                                        </h5>
                                        <span className="text-[11px] text-muted-foreground">
                                            {canViewFinance ? "متابعة الأرباح وحجم التداول والسيولة" : "متابعة الاشتراكات ونمو المستخدمين والكورسات"}
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            )}

                            {can("logs.view") && (
                            <Link
                                href="/admin/logs"
                                className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between block group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">سجل العمليات والنشاطات (Logs)</h5>
                                        <span className="text-[11px] text-muted-foreground">رصد عمليات الشحن والشراء وتسجيلات الدخول</span>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            )}

                            {can("payments.manage") && (
                            <Link
                                href="/admin/payments"
                                className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between block group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">مراجعة طلبات شحن المحفظة</h5>
                                        <span className="text-[11px] text-muted-foreground">اعتماد أو رفض تحويلات فودافون كاش وإنستاباي</span>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            )}

                            {can("withdrawals.manage") && (
                            <Link
                                href="/admin/withdrawals"
                                className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between block group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                                        <Coins className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">طلبات سحب أرباح المحاضرين</h5>
                                        <span className="text-[11px] text-muted-foreground">تسوية وتحويل مستحقات المعلمين</span>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            )}
                        </CardContent>
                    </Card>
                    )}

                    {stats.pendingCourses > 0 && can("courses.review") && (
                        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold">كورسات جديدة بانتظار موافقتك</p>
                                <p className="text-[11px] mt-0.5">لديك {stats.pendingCourses} كورس مرسل من المدرسين بانتظار التدقيق والاعتماد ليظهر للطلاب.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle?: string; icon: React.ReactNode; color: string }) {
    return (
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">{title}</CardTitle>
                <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-foreground">{value}</div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </CardContent>
        </Card>
    )
}
