"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Users,
    Mail,
    Phone,
    GraduationCap,
    Loader2,
    TrendingUp,
    CheckCircle2,
    FileText,
    ArrowRight,
    Calendar,
    Award,
    Activity,
    UserMinus,
    MessageSquare,
    CheckCircle
} from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function StudentProfilePage() {
    const { studentId } = useParams()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [instructor, setInstructor] = useState<any>(null)
    const [studentProfile, setStudentProfile] = useState<any>(null)
    const [enrollments, setEnrollments] = useState<any[]>([])
    const [submissions, setSubmissions] = useState<any[]>([])
    const [instructorCourses, setInstructorCourses] = useState<Map<string, any>>(new Map())
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null)
    const [isGradingSheetOpen, setIsGradingSheetOpen] = useState(false)
    const [currentExamData, setCurrentExamData] = useState<any>(null)
    const [gradingScores, setGradingScores] = useState<Record<string, number>>({})
    const [isSubmittingGrade, setIsSubmittingGrade] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setInstructor(user)
                fetchStudentData(user.uid)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [studentId])

    const openGradingSheet = async (sub: any) => {
        setSelectedSubmission(sub)
        setIsGradingSheetOpen(true)
        setGradingScores({})

        // Fetch original exam/lesson data to get the questions
        try {
            const courseRef = doc(db, "courses", sub.course_id)
            const courseSnap = await getDoc(courseRef)
            if (courseSnap.exists()) {
                const courseData = courseSnap.data()
                const lesson = courseData.modules?.flatMap((m: any) => m.lessons).find((l: any) => String(l.id) === String(sub.lesson_id))
                if (lesson && lesson.questions) {
                    setCurrentExamData(lesson)

                    // Initialize scores for essay questions
                    const initialScores: Record<string, number> = {}
                    lesson.questions?.forEach((q: any) => {
                        if (q.type === 'essay') {
                            initialScores[q.id] = sub.grading_details?.[q.id] || 0
                        }
                    })
                    setGradingScores(initialScores)
                }
            }
        } catch (error) {
            console.error("Error fetching exam data for grading:", error)
            toast.error("فشل في تحميل بيانات الاختبار")
        }
    }

    const saveGrades = async () => {
        if (!selectedSubmission || !currentExamData) return
        setIsSubmittingGrade(true)

        try {
            // Recalculate total score
            let totalPoints = 0
            let earnedPoints = 0

            currentExamData.questions.forEach((q: any) => {
                const qPts = q.points || 1
                totalPoints += qPts
                if (q.type === 'essay') {
                    earnedPoints += (gradingScores[q.id] || 0)
                } else {
                    if (selectedSubmission.answers[q.id] === q.correctAnswer) {
                        earnedPoints += qPts
                    }
                }
            })

            const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

            const subRef = doc(db, "submissions", selectedSubmission.id)
            await updateDoc(subRef, {
                score: finalScore,
                needs_grading: false,
                grading_details: gradingScores,
                graded_at: Timestamp.now(),
                graded_by: instructor?.uid
            })

            toast.success("تم حفظ الدرجات وتحديث النتيجة!")
            setIsGradingSheetOpen(false)
            fetchStudentData(instructor?.uid) // Refresh data
        } catch (error) {
            console.error("Error saving grades:", error)
            toast.error("حدث خطأ أثناء حفظ التصحيح")
        } finally {
            setIsSubmittingGrade(false)
        }
    }

    async function fetchStudentData(instructorId: string) {
        setIsLoading(true)
        try {
            // 1. Fetch Student Profile
            const profileSnap = await getDoc(doc(db, "profiles", studentId as string))
            if (profileSnap.exists()) {
                setStudentProfile(profileSnap.data())
            } else {
                toast.error("بروفايل الطالب غير موجود")
                router.push("/instructor/students")
                return
            }

            // 2. Fetch Instructor Courses to filter data
            const coursesQ = query(collection(db, "courses"), where("instructor_id", "==", instructorId))
            const coursesSnap = await getDocs(coursesQ)
            const coursesMap = new Map<string, any>(coursesSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]))
            setInstructorCourses(coursesMap)
            const courseIds = Array.from(coursesMap.keys())

            if (courseIds.length === 0) {
                setEnrollments([])
                setSubmissions([])
                setIsLoading(false)
                return
            }

            // 3. Fetch Enrollments for this student in these courses
            const enrollmentsQ = query(
                collection(db, "enrollments"),
                where("student_id", "==", studentId),
                where("course_id", "in", courseIds)
            )
            const enrollmentsSnap = await getDocs(enrollmentsQ)
            setEnrollments(enrollmentsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                courseTitle: coursesMap.get(doc.data().course_id)?.title || "كورس غير معروف"
            })))

            // 4. Fetch Submissions
            const subsQ = query(
                collection(db, "submissions"),
                where("student_id", "==", studentId)
            )
            const subsSnap = await getDocs(subsQ)
            const allSubs = subsSnap.docs.map(doc => doc.data())
            // Filter submissions to only those belonging to instructor's courses
            setSubmissions(allSubs.filter(s => courseIds.includes(s.course_id)))

        } catch (error) {
            console.error("Error fetching student data:", error)
            toast.error("فشل في تحميل بيانات الطالب")
        } finally {
            setIsLoading(false)
        }
    }

    const handleKick = async () => {
        if (!window.confirm("هل أنت متأكد من استبعاد الطالب من جميع كورساتك؟ لا يمكن التراجع عن هذا الإجراء.")) return

        setIsActionLoading(true)
        try {
            const batch = enrollments.map(enr => deleteDoc(doc(db, "enrollments", enr.id)))
            await Promise.all(batch)
            toast.success("تم استبعاد الطالب بنجاح")
            router.push("/instructor/students")
        } catch (error) {
            console.error("Kick error:", error)
            toast.error("حدث خطأ أثناء استبعاد الطالب")
        } finally {
            setIsActionLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const stats = {
        totalCourses: enrollments.length,
        avgProgress: enrollments.length > 0
            ? Math.round(enrollments.reduce((acc, curr) => acc + (curr.progress || 0), 0) / enrollments.length)
            : 0,
        avgScore: submissions.length > 0
            ? Math.round(submissions.reduce((acc, curr) => acc + (curr.score || 0), 0) / submissions.length)
            : 0,
        completedModules: enrollments.reduce((acc, curr) => {
            const courseData = instructorCourses.get(curr.course_id)
            if (!courseData || !courseData.modules) return acc

            const completedLessons = curr.completed_lessons || []
            const finishedModules = courseData.modules.filter((mod: any) =>
                mod.lessons && mod.lessons.length > 0 && mod.lessons.every((les: any) => completedLessons.includes(les.id))
            )
            return acc + finishedModules.length
        }, 0)
    }

    return (
        <div className="container py-10 space-y-8 font-arabic animate-in fade-in duration-500">
            {/* Header & Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
                <div className="flex items-center gap-6">
                    <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-12 w-12 hover:bg-primary hover:text-white transition-all shadow-sm">
                        <ArrowRight className="h-6 w-6" />
                    </Button>
                    <div className="flex items-center gap-5">
                        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-2 border-primary/20 shadow-inner overflow-hidden">
                            {studentProfile?.avatar_url ? (
                                <img src={studentProfile.avatar_url} alt={studentProfile.full_name} className="w-full h-full object-cover" />
                            ) : (
                                studentProfile?.full_name?.charAt(0) || "S"
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">{studentProfile?.full_name}</h1>
                            <div className="flex flex-wrap gap-3 mt-2">
                                <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
                                    <Mail className="h-3.5 w-3.5" />
                                    {studentProfile?.email}
                                </Badge>
                                <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-primary/30 text-primary">
                                    <Activity className="h-3.5 w-3.5" />
                                    طالب نشط
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="destructive" className="gap-2 px-6 rounded-xl hover:shadow-lg transition-all" onClick={handleKick} disabled={isActionLoading}>
                        {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                        استبعاد من الكورسات
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "الكورسات المشترك بها", value: stats.totalCourses, icon: GraduationCap, color: "bg-blue-50 text-blue-600" },
                    { label: "متوسط التقدم الحالي", value: `${stats.avgProgress}%`, icon: TrendingUp, color: "bg-orange-50 text-orange-600" },
                    { label: "متوسط الدرجات", value: `${stats.avgScore}%`, icon: Award, color: "bg-green-50 text-green-600" },
                    { label: "الوحدات المكتملة", value: stats.completedModules, icon: CheckCircle2, color: "bg-purple-50 text-purple-600" },
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors">
                        <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                            <p className="text-2xl font-black">{stat.value}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Details & Contact */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-2 shadow-xl overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                معلومات التواصل
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/20">
                                    <Phone className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground">رقم هاتف الطالب</p>
                                        <p className="font-bold text-lg tabular-nums">{studentProfile?.phone || "غير متوفر"}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/20">
                                    <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground">رقم هاتف ولي الأمر</p>
                                        <p className="font-bold text-lg tabular-nums">{studentProfile?.parent_phone || "غير متوفر"}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/20">
                                    <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground">تاريخ الانضمام للأكاديمية</p>
                                        <p className="font-bold text-lg">
                                            {studentProfile?.created_at ? new Date(studentProfile.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : "غير معروف"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Progress & Performance */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Course Progress */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <GraduationCap className="h-7 w-7 text-primary" />
                            التقدم الدراسي في كورساتي
                        </h2>
                        <div className="grid grid-cols-1 gap-4">
                            {enrollments.length > 0 ? enrollments.map((enr) => (
                                <Card key={enr.id} className="group hover:border-primary/40 transition-all border-2">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h3 className="text-xl font-black group-hover:text-primary transition-colors">{enr.courseTitle}</h3>
                                                    {enr.progress >= 100 && <Badge className="bg-green-600 text-[10px]">مكتمل</Badge>}
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs font-bold px-1">
                                                        <span>نسبة الإنجاز</span>
                                                        <span>{enr.progress}%</span>
                                                    </div>
                                                    <Progress value={enr.progress} className="h-2.5" />
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground font-bold">
                                                    <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        {enr.completed_lessons?.length || 0} محاضرة
                                                    </span>
                                                    <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        بدأ في {new Date(enr.enrolled_at).toLocaleDateString('ar-EG')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )) : (
                                <div className="text-center py-12 bg-muted/10 rounded-3xl border-2 border-dashed">
                                    <p className="font-bold text-muted-foreground">لا توجد اشتراكات فعالة حالياً</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Performance History */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <FileText className="h-7 w-7 text-primary" />
                            سجل الاختبارات والواجبات
                        </h2>
                        <Card className="border-2">
                            <CardContent className="p-0">
                                {submissions.length > 0 ? (
                                    <div className="divide-y-2 divide-muted/30">
                                        {submissions.sort((a, b) => (b.submitted_at?.seconds - a.submitted_at?.seconds)).map((sub, idx) => (
                                            <div key={idx} className="p-6 hover:bg-zinc-50 transition-colors flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${sub.type === 'assignment' ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                                                        {sub.type === 'assignment' ? <FileText className="h-6 w-6" /> : <Award className="h-6 w-6" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-lg">
                                                            {sub.type === 'assignment' ? "واجب منزلي" : "درجة اختبار"} - {instructorCourses.get(sub.course_id)?.title || "الكورس"}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground font-bold">
                                                            تاريخ التسليم: {sub.submitted_at?.seconds ? new Date(sub.submitted_at.seconds * 1000).toLocaleDateString('ar-EG') : "غير معروف"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1">
                                                    {sub.needs_grading ? (
                                                        <div className="flex flex-col items-end gap-2">
                                                            <Badge className="bg-blue-600 animate-pulse text-[10px] px-3 py-1">في انتظار التصحيح</Badge>
                                                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => openGradingSheet(sub)}>
                                                                <FileText className="h-3 w-3" />
                                                                تصحيح الآن
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className={`text-2xl font-black px-4 py-1.5 rounded-2xl ${sub.score >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {sub.score}%
                                                        </div>
                                                    )}
                                                    <p className="text-[10px] font-bold text-muted-foreground mt-1 tracking-widest uppercase">النتيجة النهائية</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16">
                                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                        <p className="font-bold text-muted-foreground">لم يتم تسليم أي واجبات أو اختبارات بعد</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>

            {/* Grading Sheet */}
            <Sheet open={isGradingSheetOpen} onOpenChange={setIsGradingSheetOpen}>
                <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto font-arabic">
                    <SheetHeader className="text-right border-b pb-6">
                        <SheetTitle className="text-2xl font-black">تصحيح إجابات الطالب</SheetTitle>
                        <SheetDescription className="text-sm font-bold">
                            قم بمراجعة الإجابات المقالية ورصد الدرجة المستحقة لكل سؤال.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedSubmission && currentExamData && (
                        <div className="py-8 space-y-8">
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-6">
                                <h4 className="font-bold text-primary mb-1">{instructorCourses.get(selectedSubmission.course_id)?.title}</h4>
                                <p className="text-xs text-muted-foreground font-bold">تاريخ التسليم: {selectedSubmission.submitted_at?.seconds ? new Date(selectedSubmission.submitted_at.seconds * 1000).toLocaleString('ar-EG') : "غير معروف"}</p>
                            </div>

                            {currentExamData.questions.map((q: any, idx: number) => {
                                if (q.type !== 'essay') return null;
                                return (
                                    <Card key={idx} className="border-2 shadow-sm">
                                        <CardHeader className="bg-muted/30 pb-3">
                                            <div className="flex justify-between items-start">
                                                <Badge variant="outline" className="mb-2">سؤال مقالي {idx + 1}</Badge>
                                                <Badge className="bg-zinc-800 text-[10px]">{q.points || 1} نقاط</Badge>
                                            </div>
                                            <h5 className="font-bold text-lg leading-relaxed">{q.text || "سؤال مقالي"}</h5>
                                            {(q.imageUrl || q.image_url) && (
                                                <div className="mt-4 border rounded-lg overflow-hidden max-w-sm bg-white">
                                                    <img src={q.imageUrl || q.image_url} alt="Question" className="w-full h-auto" />
                                                </div>
                                            )}
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-muted-foreground">إجابة الطالب:</Label>
                                                <div className="p-4 rounded-xl bg-zinc-50 border whitespace-pre-wrap text-sm leading-relaxed min-h-[100px]">
                                                    {selectedSubmission.answers[q.id] || <span className="text-red-400 italic">لم يقم الطالب بالإجابة</span>}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-primary">رصد الدرجة (من {q.points || 1}):</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={q.points || 1}
                                                    step="0.5"
                                                    value={gradingScores[q.id] || 0}
                                                    onChange={(e) => setGradingScores({ ...gradingScores, [q.id]: parseFloat(e.target.value) })}
                                                    className="font-bold text-lg h-12 border-2 focus:border-primary"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    <SheetFooter className="mt-8 border-t pt-6">
                        <Button className="w-full h-14 text-lg font-bold gap-2" onClick={saveGrades} disabled={isSubmittingGrade}>
                            {isSubmittingGrade ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                            اعتماد التصحيح وحفظ النتيجة
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    )
}
