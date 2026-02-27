"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
    Users,
    BookOpen,
    DollarSign,
    TrendingUp,
    Settings,
    Trash2
} from "lucide-react"
import { toast } from "sonner"
import { deleteDoc, doc } from "firebase/firestore"

export default function InstructorDashboard() {
    const [user, setUser] = useState<any>(null)
    const [courses, setCourses] = useState<any[]>([])

    const handleDeleteCourse = async (courseId: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا الكورس؟ لا يمكن التراجع عن هذا الإجراء.")) return

        try {
            await deleteDoc(doc(db, "courses", courseId))
            setCourses(courses.filter(c => c.id !== courseId))
            toast.success("تم حذف الكورس بنجاح")
        } catch (error) {
            console.error("Delete error:", error)
            toast.error("حدث خطأ أثناء الحذف")
        }
    }
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalRevenue: 0,
        avgCompletion: 0
    })
    const [recentEnrollments, setRecentEnrollments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                try {
                    // 1. Fetch Instructor Courses
                    const coursesQ = query(collection(db, "courses"), where("instructor_id", "==", currentUser.uid))
                    const coursesSnap = await getDocs(coursesQ)
                    const instructorCourses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    setCourses(instructorCourses)

                    if (instructorCourses.length > 0) {
                        // 2. Fetch Enrollments for THIS instructor (all their courses)
                        const enrollmentsQ = query(
                            collection(db, "enrollments"),
                            where("instructor_id", "==", currentUser.uid)
                        )
                        const enrollmentsSnap = await getDocs(enrollmentsQ)
                        const allEnrollments = enrollmentsSnap.docs.map(doc => doc.data())

                        setStats({
                            totalStudents: allEnrollments.length,
                            totalRevenue: instructorCourses.reduce((acc, c: any) => {
                                const count = allEnrollments.filter(e => e.course_id === c.id).length
                                return acc + (count * (c.price || 0))
                            }, 0),
                            avgCompletion: allEnrollments.length > 0
                                ? Math.round(allEnrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / allEnrollments.length)
                                : 0
                        })

                        // 3. Set Recent Enrollments
                        setRecentEnrollments(allEnrollments.sort((a, b) =>
                            new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime()
                        ).slice(0, 5))
                    }
                } catch (error) {
                    console.error("Error fetching instructor data:", error)
                } finally {
                    setLoading(false)
                }
            }
        })
        return () => unsubscribe()
    }, [])

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">أهلاً بك مجدداً، {user?.displayName || "مدربنا"} 👋</h2>
                <p className="text-muted-foreground">إليك نظرة سريعة على أداء كورساتك لهذا الشهر.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="إجمالي الطلاب"
                    value={stats.totalStudents.toString()}
                    description="الطلاب المشتركون في كورساتك"
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    title="الكورسات النشطة"
                    value={courses.filter(c => c.status === 'approved').length.toString()}
                    description={`من إجمالي ${courses.length} كورس`}
                    icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    title="إجمالي الأرباح"
                    value={`${stats.totalRevenue.toLocaleString()} ج.م`}
                    description="إجمالي مبيعات الكورسات"
                    icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    title="متوسط التقدم"
                    value={`${stats.avgCompletion}%`}
                    description="متوسط إكمال الطلاب للمحتوى"
                    icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>كورساتي</CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/instructor/courses/new">إضافة كورس جديد</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {courses.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-8">لا يوجد لديك كورسات حالياً.</p>
                            ) : (
                                courses.slice(0, 5).map((course: any) => (
                                    <div key={course.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-20 rounded bg-muted overflow-hidden">
                                                <img src={course.thumbnail_url || course.thumbnail || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"} alt={course.title} className="object-cover w-full h-full" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{course.title}</p>
                                                <p className="text-xs text-muted-foreground">{course.category} • {course.grade_level}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex gap-2">
                                                <Badge
                                                    variant={course.status === 'approved' ? 'default' : course.status === 'rejected' ? 'destructive' : 'secondary'}
                                                    className="text-[10px]"
                                                >
                                                    {course.status === 'approved' ? 'منشور' : course.status === 'rejected' ? 'مرفوض / مستبعد' : 'بانتظار المراجعة'}
                                                </Badge>
                                                <p className="font-bold text-sm">{course.price} ج.م</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
                                                    <Link href={`/instructor/courses/${course.id}/manage`}>
                                                        <Settings className="h-3 w-3" />
                                                        تعديل
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs text-destructive hover:bg-destructive hover:text-white gap-1"
                                                    onClick={() => handleDeleteCourse(course.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                    حذف
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>آخر التسجيلات</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentEnrollments.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-8">لا توجد تسجيلات جديدة حالياً.</p>
                            ) : (
                                recentEnrollments.map((enr, i) => (
                                    <div key={i} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                            {enr.student_name?.charAt(0) || "S"}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                انضم {enr.student_name || "طالب"} لكورس
                                                <span className="text-primary font-bold"> {courses.find(c => c.id === enr.course_id)?.title}</span>
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(enr.enrolled_at).toLocaleDateString('ar-EG')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function StatCard({ title, value, description, icon }: { title: string, value: string, description: string, icon: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    )
}
