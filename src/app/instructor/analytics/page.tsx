"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { calculateEnrollmentCommission } from "@/lib/commission-utils"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Users,
    BookOpen,
    DollarSign,
    TrendingUp,
    Award,
    Activity,
    Calendar,
    ArrowUpRight,
    Loader2,
    Ticket,
    CheckCircle
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer, Download } from "lucide-react"
import { toast } from "sonner"

export default function InstructorAnalyticsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeCourses: 0,
        totalRevenue: 0,
        platformCommission: 0,
        netRevenue: 0,
        avgCompletion: 0,
        topCourse: "",
        monthlyGrowth: 15
    })
    const [courseBreakdown, setCourseBreakdown] = useState<any[]>([])
    const [recentEnrollments, setRecentEnrollments] = useState<any[]>([])
    const [couponUsages, setCouponUsages] = useState<any[]>([])

    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u)
            if (u) {
                fetchAnalytics(u.uid)
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchAnalytics(instructorId: string) {
        setIsLoading(true)
        try {
            // 1. Fetch Courses
            const coursesQ = query(collection(db, "courses"), where("instructor_id", "==", instructorId))
            const coursesSnap = await getDocs(coursesQ)
            const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            // 2. Fetch Enrollments
            const enrollmentsQ = query(collection(db, "enrollments"), where("instructor_id", "==", instructorId))
            const enrollmentsSnap = await getDocs(enrollmentsQ)
            const enrollments = enrollmentsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a: any, b: any) => {
                    const dateA = a.enrolled_at ? new Date(a.enrolled_at).getTime() : 0
                    const dateB = b.enrolled_at ? new Date(b.enrolled_at).getTime() : 0
                    return dateB - dateA
                }) as any[]

            // 3. Process Stats
            let totalCommission = 0
            let totalNet = 0
            
            enrollments.forEach((enr: any) => {
                const { commissionAmount, netAmount } = calculateEnrollmentCommission(
                    Number(enr.paid_amount) || 0,
                    instructorId
                )
                totalCommission += commissionAmount
                totalNet += netAmount
            })

            const grossRevenue = enrollments.reduce((acc, e: any) => acc + (Number(e.paid_amount) || 0), 0)

            const breakdown = courses.map((c: any) => {
                const courseEnrollments = enrollments.filter(e => e.course_id === c.id)
                const enrollmentCount = courseEnrollments.length
                const courseRevenue = courseEnrollments.reduce((acc, e: any) => acc + (Number(e.paid_amount) || 0), 0)
                const avgProg = enrollmentCount > 0
                    ? Math.round(courseEnrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / enrollmentCount)
                    : 0
                return {
                    title: c.title,
                    students: enrollmentCount,
                    progress: avgProg,
                    revenue: courseRevenue
                }
            }).sort((a, b) => b.students - a.students)

            setStats({
                totalStudents: enrollments.length,
                activeCourses: courses.filter((c: any) => c.status === 'approved').length,
                totalRevenue: grossRevenue,
                platformCommission: totalCommission,
                netRevenue: totalNet,
                avgCompletion: enrollments.length > 0
                    ? Math.round(enrollments.reduce((acc, e: any) => acc + (e.progress || 0), 0) / enrollments.length)
                    : 0,
                topCourse: breakdown[0]?.title || "لا يوجد بعد",
                monthlyGrowth: 12
            })
            setCourseBreakdown(breakdown)
            setRecentEnrollments(enrollments.slice(0, 5))

            // Filter Used Coupons
            const coupons = enrollments.filter(e => e.coupon_used).map(e => {
                const discountVal = (e.original_price || 0) - (e.paid_amount || 0)
                return {
                    ...e,
                    discountValue: discountVal > 0 ? discountVal : "N/A"
                }
            })
            setCouponUsages(coupons)

        } catch (error) {
            console.error("Analytics error:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const printRef = useRef<HTMLDivElement>(null)

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
                    <title>تقرير الأداء المالي - ${user?.displayName || "محاضر"}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 40px; color: #333; }
                        .header { text-align: center; border-bottom: 3px solid #f0f0f0; margin-bottom: 30px; padding-bottom: 20px; }
                        .stats-grid { display: grid; grid-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .stat-box { border: 1px solid #eee; padding: 15px; border-radius: 10px; text-align: center; }
                        .stat-label { font-size: 0.8em; color: #666; font-weight: bold; }
                        .stat-value { font-size: 1.5em; font-weight: 800; color: #d9410e; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 12px; border: 1px solid #eee; text-align: right; }
                        th { background: #f9f9f9; font-weight: bold; }
                        .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>تقرير الأداء والتحليلات المالية</h1>
                        <p>اسم المحاضر: ${user?.displayName || "غير متوفر"}</p>
                        <p>تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                    </div>

                    <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                        <div class="stat-box" style="flex: 1;">
                            <div class="stat-label">إجمالي الطلاب</div>
                            <div class="stat-value">${stats.totalStudents}</div>
                        </div>
                        <div class="stat-box" style="flex: 1;">
                            <div class="stat-label">صافي الأرباح</div>
                            <div class="stat-value">${stats.netRevenue.toLocaleString()} ج.م</div>
                        </div>
                    </div>

                    <h3>تفاصيل أداء الكورسات</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الكورس</th>
                                <th>عدد الطلاب</th>
                                <th>إجمالي المبيعات</th>
                                <th>متوسط التقدم</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${courseBreakdown.map(c => `
                                <tr>
                                    <td>${c.title}</td>
                                    <td>${c.students}</td>
                                    <td>${c.revenue.toLocaleString()} ج.م</td>
                                    <td>${c.progress}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        <p>تم استخراج هذا التقرير آلياً من منصة منارة أكاديمي للتعليم الإلكتروني.</p>
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

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black italic">لوحة التميز المالي والأداء 📈</h1>
                    <p className="text-muted-foreground mt-1 italic">شفافية كاملة لأرباحك وتفاعل طلابك خطوة بخطوة</p>
                </div>
                <Button variant="outline" className="gap-2 font-bold bg-white" onClick={handlePrint}>
                    <Printer className="h-4 w-4" />
                    استخراج تقرير مالي
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <AnalyticsCard
                    title="الطلاب الجدد"
                    value={stats.totalStudents.toString()}
                    trend={"+12% هذا الشهر"}
                    color="bg-blue-50 text-blue-600"
                    icon={<Users className="h-5 w-5" />}
                />
                <AnalyticsCard
                    title="إجمالي الأرباح (Gross)"
                    value={`${stats.totalRevenue.toLocaleString()} ج.م`}
                    trend={"قبل الخصومات"}
                    color="bg-green-50 text-green-600"
                    icon={<DollarSign className="h-5 w-5" />}
                />
                <AnalyticsCard
                    title="عمولة المنصة (20%)"
                    value={`${stats.platformCommission.toLocaleString()} ج.م`}
                    trend={"ثابتة لكافة الكورسات"}
                    color="bg-red-50 text-red-600"
                    icon={<TrendingUp className="h-5 w-5" />}
                />
                <AnalyticsCard
                    title="صافي أرباحك ✨"
                    value={`${stats.netRevenue.toLocaleString()} ج.م`}
                    trend={"جاهزة للسحب"}
                    color="bg-orange-50 text-orange-600"
                    icon={<Award className="h-5 w-5" />}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-2 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold">تتبع الكوبونات المستخدمة 🎫</CardTitle>
                            <CardDescription>الطلاب الذين استخدموا أكواد الخصم للالتحاق بكورساتك</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-muted/50 text-muted-foreground font-bold italic">
                                    <tr>
                                        <th className="p-4">التاريخ 📅</th>
                                        <th className="p-4">الطالب</th>
                                        <th className="p-4 text-center">الكود</th>
                                        <th className="p-4">الكورس</th>
                                        <th className="p-4">الخصم</th>
                                        <th className="p-4 text-left">الصافي المدفوع</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {couponUsages.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-10 text-center text-muted-foreground italic">لم يتم استخدام كوبونات بعد</td>
                                        </tr>
                                    ) : (
                                        couponUsages.map((usage, i) => (
                                            <tr key={usage.id} className="hover:bg-muted/30 transition-colors border-b last:border-0 grow">
                                                <td className="p-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                    {usage.enrolled_at ? new Date(usage.enrolled_at).toLocaleDateString('ar-EG', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    }) : "N/A"}
                                                </td>
                                                <td className="p-4 font-bold text-zinc-900">{usage.student_name}</td>
                                                <td className="p-4 text-center">
                                                    <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20 px-3 py-1">
                                                        {usage.coupon_used}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 truncate max-w-[200px] text-zinc-600 font-medium">{usage.course_title}</td>
                                                <td className="p-4">
                                                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 font-black">
                                                        {usage.discountValue !== "N/A" ? `-${usage.discountValue?.toLocaleString()} ج.م` : "N/A"}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-left">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-primary text-base">{usage.paid_amount?.toLocaleString()} ج.م</span>
                                                        <span className="text-[10px] line-through text-muted-foreground opacity-50">{usage.original_price?.toLocaleString()} ج.م</span>
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

                <div className="space-y-6">
                    <Card className="border-2 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                آخر عمليات الالتحاق
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {recentEnrollments.length === 0 ? (
                                    <div className="p-6 text-center text-muted-foreground text-xs italic">
                                        لا توجد عمليات مؤخراً
                                    </div>
                                ) : (
                                    recentEnrollments.map((enr, i) => (
                                        <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm truncate max-w-[120px]">{enr.student_name}</span>
                                                    {enr.coupon_used && <Ticket className="h-3 w-3 text-primary" />}
                                                </div>
                                                <span className="font-black text-xs text-primary">{enr.paid_amount || 0} ج.م</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                <span className="font-mono">{enr.student_unique_id || "N/A"}</span>
                                                <span>{enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString('ar-EG') : ""}</span>
                                            </div>
                                            <p className="text-[10px] mt-1 text-muted-foreground truncate">{enr.course_title}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-2 shadow-sm bg-orange-50 border-orange-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                <ArrowUpRight className="h-4 w-4" />
                                إحصائيات سريعة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span>متوسط تقدم الطلاب</span>
                                    <span>{stats.avgCompletion}%</span>
                                </div>
                                <Progress value={stats.avgCompletion} className="h-2" />
                            </div>
                            <p className="text-[10px] text-orange-900 leading-relaxed font-medium">
                                الكورس الأكثر تفاعلاً هو <span className="font-bold text-primary underline">{stats.topCourse}</span>. استمر في تحديث المحتوى لزيادة التفاعل!
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-2 shadow-sm bg-primary/5 border-primary/20">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <CheckCircle className="h-6 w-6" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold">نظام العمولات</p>
                                <p className="text-[10px] text-muted-foreground font-medium">العمولة الحالية 20% ثابتة لجميع المحاضرين والطلاب.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function AnalyticsCard({ title, value, trend, icon, color }: any) {
    return (
        <Card className="border-2 shadow-sm overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase">{title}</p>
                        <h3 className="text-2xl font-black">{value}</h3>
                        <p className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                            {trend}
                        </p>
                    </div>
                    <div className={`p-3 rounded-xl ${color}`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
