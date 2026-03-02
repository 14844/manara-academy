"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
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
    Loader2
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                fetchAnalytics(user.uid)
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
            const grossRevenue = enrollments.reduce((acc, e: any) => acc + (Number(e.paid_amount) || 0), 0)
            const commission = grossRevenue * 0.15
            const net = grossRevenue - commission

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
                platformCommission: commission,
                netRevenue: net,
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

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black italic">لوحة التميز المالي والأداء 📈</h1>
                <p className="text-muted-foreground mt-1 italic">شفافية كاملة لأرباحك وتفاعل طلابك خطوة بخطوة</p>
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
                    trend={"دعم فني واستضافة"}
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
