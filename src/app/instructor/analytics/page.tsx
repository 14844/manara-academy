"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { calculateEnrollmentCommission, getSpecialOfferProgress } from "@/lib/commission-utils"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PartyPopper, Sparkles } from "lucide-react"
import {
    Users,
    BookOpen,
    DollarSign,
    TrendingUp,
    Award,
    Activity,
    Calendar,
    ArrowUpRight,
    Loader2
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

    const [user, setUser] = useState<any>(null)
    const [specialOffer, setSpecialOffer] = useState<any>(null)

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

            // 3. Process Stats (Commission logic)
            // Sort chronicological to apply special offer to first 10
            const sortedChronic = [...enrollments].sort((a: any, b: any) => {
                const dateA = a.enrolled_at ? new Date(a.enrolled_at).getTime() : 0
                const dateB = b.enrolled_at ? new Date(b.enrolled_at).getTime() : 0
                return dateA - dateB
            })

            let totalCommission = 0
            let totalNet = 0
            
            sortedChronic.forEach((enr: any, index: number) => {
                const { commissionAmount, netAmount } = calculateEnrollmentCommission(
                    Number(enr.paid_amount) || 0,
                    instructorId,
                    index
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

            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {/* Ghost element for print logic */}
                </div>
            </div>

            {user && getSpecialOfferProgress(user.uid, stats.totalStudents) && (
                <Card className="border-2 border-primary/20 bg-primary/5 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles className="h-24 w-24 text-primary" />
                    </div>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <PartyPopper className="h-6 w-6 text-primary" />
                                مسار العرض الخاص (15% عمولة)
                            </CardTitle>
                            <Badge variant="outline" className="bg-background font-bold">
                                {getSpecialOfferProgress(user.uid, stats.totalStudents)?.current} / {getSpecialOfferProgress(user.uid, stats.totalStudents)?.limit} طالب
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                                <span>حالة العرض الحالي</span>
                                <span className="text-primary">{Math.round(getSpecialOfferProgress(user.uid, stats.totalStudents)?.percentage || 0)}%</span>
                            </div>
                            <Progress value={getSpecialOfferProgress(user.uid, stats.totalStudents)?.percentage} className="h-3 rounded-full" />
                            <div className="grid grid-cols-10 gap-1 mt-1">
                                {[...Array(10)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`h-1.5 rounded-full transition-all duration-500 ${
                                            i < (getSpecialOfferProgress(user.uid, stats.totalStudents)?.current || 0) 
                                            ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" 
                                            : "bg-muted"
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {getSpecialOfferProgress(user.uid, stats.totalStudents)?.isCompleted 
                                ? "أحسنت! لقد استفدت من العرض كاملاً لجميع الطلاب العشرة الأوائل. استمر في التألق!"
                                : `باقي لك ${10 - (getSpecialOfferProgress(user.uid, stats.totalStudents)?.current || 0)} طلاب حتى تكتمل قائمة الـ 10 طلاب المستفيدين من العمولة المخفضة.`
                            }
                        </p>
                    </CardContent>
                </Card>
            )}

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
                    title="عمولة المنصة"
                    value={`${stats.platformCommission.toLocaleString()} ج.م`}
                    trend={"تحسب تلقائياً حسب العرض"}
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
                            <CardTitle className="text-xl font-bold">أداء الكورسات الفردي</CardTitle>
                            <CardDescription>نسبة تفاعل الطلاب لكل كورس تعليمي</CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1 px-3 py-1">
                            <TrendingUp className="h-3 w-3" />
                            الأكثر مبيعاً
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {courseBreakdown.map((course, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20">
                                            {i + 1}
                                        </div>
                                        <span className="font-bold">{course.title}</span>
                                    </div>
                                    <div className="text-left font-mono">
                                        <span className="text-muted-foreground mr-2">{course.students} طالب</span>
                                        <span className="font-bold text-primary">{course.revenue.toLocaleString()} ج.م</span>
                                    </div>
                                </div>
                                <div className="space-y-1 pr-13">
                                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                        <span>تقدم الطلاب بالمنهج</span>
                                        <span>{course.progress}%</span>
                                    </div>
                                    <Progress value={course.progress} className="h-1.5" />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-2 shadow-sm bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Award className="h-5 w-5 text-primary" />
                                الكورس الأكثر تفاعلاً
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center py-6">
                            <div className="text-primary font-black text-2xl mb-2">{stats.topCourse}</div>
                            <p className="text-sm text-muted-foreground italic">هذا الكورس يمتلك أعلى معدل إكمال من قبل الطلاب</p>
                        </CardContent>
                    </Card>

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
                                                <span className="font-bold text-sm truncate max-w-[120px]">{enr.student_name}</span>
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
                                التزام المنصة
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[10px] text-orange-900 leading-relaxed font-medium">
                                تلتزم منصة المنارة بالشفافية المطلقة. يمكنك تتبع كل عملية التحاق وقيمتها هنا. عمولة المنصة (20%) تغطي الدعم الفني، التسويق، واستضافة المحتوى المؤمن.
                            </p>
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
