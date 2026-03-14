"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    FileText,
    Loader2,
    CheckCircle,
    User,
    Calendar,
    BookOpen,
    ArrowRight,
    Search,
    AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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

export default function InstructorGradingPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [instructor, setInstructor] = useState<any>(null)
    const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
    const [coursesMap, setCoursesMap] = useState<Map<string, any>>(new Map())
    const [studentProfiles, setStudentProfiles] = useState<Map<string, any>>(new Map())

    // Grading Sheet State
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null)
    const [isGradingSheetOpen, setIsGradingSheetOpen] = useState(false)
    const [currentExamData, setCurrentExamData] = useState<any>(null)
    const [gradingScores, setGradingScores] = useState<Record<string, number>>({})
    const [isSubmittingGrade, setIsSubmittingGrade] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setInstructor(user)
                fetchData(user.uid)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchData(instructorId: string) {
        setIsLoading(true)
        try {
            // 1. Fetch Instructor Courses
            const coursesQ = query(collection(db, "courses"), where("instructor_id", "==", instructorId))
            const coursesSnap = await getDocs(coursesQ)
            const cMap = new Map()
            coursesSnap.docs.forEach(doc => cMap.set(doc.id, { id: doc.id, ...doc.data() }))
            setCoursesMap(cMap)
            const courseIds = Array.from(cMap.keys())

            if (courseIds.length === 0) {
                setPendingSubmissions([])
                setIsLoading(false)
                return
            }

            // 2. Fetch Submissions that need grading
            // Note: Since courseIds could be > 30, we fetch all where needs_grading == true and filter in memory
            // unless we prefer multiple queries. For now, in-memory filter is safer for logic simplicity.
            const submissionsQ = query(
                collection(db, "submissions"),
                where("needs_grading", "==", true)
            )
            const subsSnap = await getDocs(submissionsQ)
            const filteredSubs = subsSnap.docs
                .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
                .filter(sub => courseIds.includes(sub.course_id))
                .sort((a: any, b: any) => (b.submitted_at?.seconds || 0) - (a.submitted_at?.seconds || 0))

            setPendingSubmissions(filteredSubs)

            // 3. Fetch Student Profiles for these submissions
            const studentIds = Array.from(new Set(filteredSubs.map(s => s.student_id)))
            const pMap = new Map()
            for (const sId of studentIds) {
                const pDoc = await getDoc(doc(db, "profiles", sId))
                if (pDoc.exists()) pMap.set(sId, pDoc.data())
            }
            setStudentProfiles(pMap)

        } catch (error) {
            console.error("Error fetching grading data:", error)
            toast.error("فشل في تحميل البيانات")
        } finally {
            setIsLoading(false)
        }
    }

    const openGradingSheet = async (sub: any) => {
        setSelectedSubmission(sub)
        setIsGradingSheetOpen(true)
        setGradingScores({})

        const courseData = coursesMap.get(sub.course_id)
        if (courseData) {
            const lesson = courseData.modules?.flatMap((m: any) => m.lessons).find((l: any) => String(l.id) === String(sub.lesson_id))
            if (lesson && lesson.questions) {
                setCurrentExamData(lesson)

                const initialScores: Record<string, number> = {}
                lesson.questions?.forEach((q: any) => {
                    if (q.type === 'essay') {
                        initialScores[q.id] = sub.grading_details?.[q.id] || 0
                    }
                })
                setGradingScores(initialScores)
            } else {
                toast.error("لم يتم العثور على الأسئلة الأصلية")
            }
        }
    }

    const saveGrades = async () => {
        if (!selectedSubmission || !currentExamData) return
        setIsSubmittingGrade(true)

        try {
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

            toast.success("تم التصحيح بنجاح!")
            setIsGradingSheetOpen(false)
            setPendingSubmissions(prev => prev.filter(s => s.id !== selectedSubmission.id))
        } catch (error) {
            console.error("Error saving grades:", error)
            toast.error("حدث خطأ أثناء حفظ التصحيح")
        } finally {
            setIsSubmittingGrade(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container py-10 space-y-8 font-arabic animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black">مركز تصحيح الإجابات</h1>
                <p className="text-muted-foreground mt-1 italic">قم بمراجعة وتصحيح الأسئلة المقالية لطلابك في مكان واحد</p>
            </div>

            {pendingSubmissions.length === 0 ? (
                <Card className="border-2 border-dashed bg-muted/20 py-20">
                    <CardContent className="flex flex-col items-center justify-center gap-4">
                        <CheckCircle className="h-16 w-16 text-green-500/30" />
                        <div className="text-center">
                            <h3 className="text-xl font-bold">كل شيء مكتمل!</h3>
                            <p className="text-muted-foreground">لا توجد إجابات معلقة بانتظار التصحيح حالياً.</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {pendingSubmissions.map((sub) => {
                        const student = studentProfiles.get(sub.student_id)
                        const course = coursesMap.get(sub.course_id)
                        const lesson = course?.modules?.flatMap((m: any) => m.lessons).find((l: any) => String(l.id) === String(sub.lesson_id))

                        return (
                            <Card key={sub.id} className="group hover:border-primary/40 transition-all border-2">
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl border-2 border-primary/20">
                                                {student?.avatar_url ? (
                                                    <img src={student.avatar_url} className="w-full h-full object-cover rounded-2xl" alt="" />
                                                ) : (
                                                    <User className="h-6 w-6" />
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-lg font-black">{student?.full_name || sub.student_name || "طالب غير معروف"}</h3>
                                                <div className="flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                                                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                                                        <BookOpen className="h-3 w-3" />
                                                        {course?.title || "كورس غير معروف"}
                                                    </span>
                                                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                                                        <FileText className="h-3 w-3" />
                                                        {lesson?.title || "اختبار/واجب"}
                                                    </span>
                                                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                                                        <Calendar className="h-3 w-3" />
                                                        {sub.submitted_at?.seconds ? new Date(sub.submitted_at.seconds * 1000).toLocaleString('ar-EG') : "غير معروف"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button className="w-full md:w-auto gap-2 px-8 h-12 rounded-xl font-bold" onClick={() => openGradingSheet(sub)}>
                                            <FileText className="h-4 w-4" />
                                            بدء التصحيح
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

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
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {(studentProfiles.get(selectedSubmission.student_id)?.full_name || selectedSubmission.student_name || "?").charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-black">{studentProfiles.get(selectedSubmission.student_id)?.full_name || selectedSubmission.student_name}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold">{coursesMap.get(selectedSubmission.course_id)?.title}</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-bold">تاريخ التسليم: {selectedSubmission.submitted_at?.seconds ? new Date(selectedSubmission.submitted_at.seconds * 1000).toLocaleString('ar-EG') : "غير معروف"}</p>
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

                    {!currentExamData && (
                        <div className="py-20 text-center space-y-4">
                            <AlertCircle className="h-12 w-12 text-destructive mx-auto opacity-20" />
                            <p className="font-bold text-muted-foreground">عذراً، فشل في تحميل محتوى الأسئلة لهذا الاختبار.</p>
                        </div>
                    )}

                    <SheetFooter className="mt-8 border-t pt-6">
                        <Button className="w-full h-14 text-lg font-bold gap-2" onClick={saveGrades} disabled={isSubmittingGrade || !currentExamData}>
                            {isSubmittingGrade ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                            اعتماد التصحيح وحفظ النتيجة
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    )
}
