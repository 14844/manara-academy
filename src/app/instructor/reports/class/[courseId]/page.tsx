"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Users,
    BookOpen,
    Loader2,
    Calendar,
    Award,
    CheckCircle2,
    ArrowRight,
    Printer,
    FileText,
    TrendingUp,
    Clock,
    UserCheck
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function ClassReportPage() {
    const { courseId } = useParams()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [instructor, setInstructor] = useState<any>(null)
    const [course, setCourse] = useState<any>(null)
    const [students, setStudents] = useState<any[]>([])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setInstructor(user)
                fetchClassData(user.uid)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [courseId])

    async function fetchClassData(instructorId: string) {
        setIsLoading(true)
        try {
            // 1. Fetch Course Info
            const courseSnap = await getDoc(doc(db, "courses", courseId as string))
            if (courseSnap.exists()) {
                const cData = courseSnap.data()
                if (cData.instructor_id !== instructorId) {
                    toast.error("عذراً، لا تملك الصلاحية لعرض تقارير هذا الكورس")
                    router.push("/instructor/reports")
                    return
                }
                setCourse({ id: courseSnap.id, ...cData })
            } else {
                toast.error("الكورس غير موجود")
                router.push("/instructor/reports")
                return
            }

            // 2. Fetch Enrollments
            const enrollmentsQ = query(collection(db, "enrollments"), where("course_id", "==", courseId))
            const enrollmentsSnap = await getDocs(enrollmentsQ)
            const enrollments = enrollmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

            if (enrollments.length === 0) {
                setStudents([])
                setIsLoading(false)
                return
            }

            // Calculate total lessons
            const cData = courseSnap.data()
            const totalLessons = cData.modules?.reduce((acc: number, mod: any) => acc + (mod.lessons?.length || 0), 0) || 0

            // 3. Fetch Student profiles & submissions
            const studentList = await Promise.all(enrollments.map(async (enr) => {
                const profileSnap = await getDoc(doc(db, "profiles", enr.student_id))
                const profile = profileSnap.exists() ? profileSnap.data() : {}

                // Fetch submissions
                const subsQ = query(
                    collection(db, "submissions"),
                    where("student_id", "==", enr.student_id),
                    where("course_id", "==", courseId)
                )
                const subsSnap = await getDocs(subsQ)
                const submissions = subsSnap.docs.map(doc => doc.data())

                const avgScore = submissions.length > 0
                    ? Math.round(submissions.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / submissions.length)
                    : 0

                return {
                    id: enr.student_id,
                    name: profile.full_name || enr.student_name || "طالب غير معروف",
                    email: profile.email || "غير متوفر",
                    avatar: profile.avatar_url || null,
                    phone: profile.phone || "غير متوفر",
                    progress: enr.progress || 0,
                    completedLessons: enr.completed_lessons?.length || 0,
                    totalLessons: totalLessons,
                    lastAccessed: enr.last_accessed || null,
                    averageScore: avgScore,
                    submissionsCount: submissions.length
                }
            }))

            setStudents(studentList)
        } catch (error) {
            console.error("Error fetching class report data:", error)
            toast.error("فشل في تحميل بيانات تقرير الفصل")
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // Calculations
    const totalStudents = students.length
    const classAvgProgress = totalStudents > 0
        ? Math.round(students.reduce((acc, s) => acc + s.progress, 0) / totalStudents)
        : 0
    const classAvgScore = totalStudents > 0
        ? Math.round(students.reduce((acc, s) => acc + s.averageScore, 0) / totalStudents)
        : 0
    const totalLessons = course?.modules?.reduce((acc: number, mod: any) => acc + (mod.lessons?.length || 0), 0) || 0

    return (
        <div className="container py-8 space-y-8 font-arabic animate-in fade-in duration-500 pb-20 select-none">
            {/* Header / Top Nav */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6 print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-11 w-11 shadow-sm">
                        <ArrowRight className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            <BookOpen className="h-7 w-7 text-primary" />
                            تقرير كامل الصف الدراسي
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm font-medium">عرض أداء ومقارنات جميع طلاب كورس: <span className="font-bold text-zinc-800">{course?.title}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="lg" className="rounded-xl font-bold gap-2 h-11 border-zinc-200" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        طباعة / تصدير PDF
                    </Button>
                </div>
            </div>

            {/* PRINT-ONLY HEADER */}
            <div className="hidden print:flex flex-col gap-4 border-b pb-6 text-right mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-primary">أكاديمية المنارة التعليمية</h1>
                        <p className="text-sm font-bold text-zinc-500 mt-1">لوحة تقرير ومقارنة مستوى الفصل الدراسي</p>
                    </div>
                    <div className="text-left font-bold text-xs text-zinc-400">
                        <p>التاريخ: {new Date().toLocaleDateString("ar-EG")}</p>
                        <p>بواسطة المدرس: {course?.instructor_name}</p>
                    </div>
                </div>
                <div className="bg-zinc-50 p-4 rounded-xl border flex flex-col gap-1.5 mt-2">
                    <h2 className="text-xl font-bold">المقرر: {course?.title}</h2>
                    <p className="text-xs font-bold text-zinc-500">مجموع الطلاب المسجلين بالتقرير: {totalStudents} طالب</p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-2 shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                            <Users className="h-6 w-6" />
                        </div>
                        <p className="text-3xl font-black tabular-nums">{totalStudents}</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">إجمالي طلاب الصف</p>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <p className="text-3xl font-black tabular-nums">{classAvgProgress}%</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">متوسط تقدم الفصل الدراسي</p>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-xl bg-green-100 text-green-700">
                            <Award className="h-6 w-6" />
                        </div>
                        <p className="text-3xl font-black tabular-nums">{classAvgScore}%</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">متوسط درجات الطلاب</p>
                    </CardContent>
                </Card>
            </div>

            {/* Comparison Table */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 pb-4 border-b print:hidden">
                    <CardTitle className="text-lg font-bold">جدول المقارنة بين الطلاب</CardTitle>
                    <CardDescription className="text-xs font-bold text-muted-foreground">تفصيل مستويات جميع الطلاب المسجلين بالكورس ومعدلاتهم التعليمية.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="font-arabic min-w-full">
                            <TableHeader className="bg-zinc-50 border-b">
                                <TableRow>
                                    <TableHead className="text-right font-black text-zinc-700">اسم الطالب</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">رقم الهاتف</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">المحاضرات المكتملة</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">نسبة التقدم</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">متوسط الدرجات</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">آخر دخول للمنصة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.id} className="hover:bg-zinc-50/50">
                                        <TableCell className="font-bold py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden border">
                                                    {student.avatar ? (
                                                        <img src={student.avatar} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        student.name.charAt(0)
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span>{student.name}</span>
                                                    <span className="text-[10px] text-zinc-400 font-bold leading-none mt-0.5 print:hidden">{student.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-zinc-600 tabular-nums">{student.phone}</TableCell>
                                        <TableCell className="text-xs font-bold text-zinc-700">
                                            <span className="bg-zinc-100 px-2 py-1 rounded font-black tabular-nums">
                                                {student.completedLessons} / {student.totalLessons} محاضرة
                                            </span>
                                        </TableCell>
                                        <TableCell className="w-48 py-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-black text-primary">
                                                    <span>تقدم الكورس</span>
                                                    <span>{student.progress}%</span>
                                                </div>
                                                <Progress value={student.progress} className="h-1.5 bg-zinc-100" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${student.averageScore >= 80 ? 'bg-green-100 text-green-700' : student.averageScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600'}`}>
                                                {student.averageScore}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-muted-foreground">
                                            {student.lastAccessed ? (
                                                new Date(student.lastAccessed).toLocaleDateString("ar-EG")
                                            ) : (
                                                <span className="text-zinc-300 italic font-medium">لم يدخل بعد</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* CSS Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .container {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .hidden.print\\:flex {
                        display: flex !important;
                    }
                    table {
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #e2e8f0 !important;
                        padding: 12px 10px !important;
                    }
                }
            `}</style>
        </div>
    )
}
