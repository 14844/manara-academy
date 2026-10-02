"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    PlayCircle,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    Menu,
    FileText,
    MessageSquare,
    Video,
    ClipboardList,
    HelpCircle,
    Lock,
    Search,
    Loader2
} from "lucide-react"
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import { SecureVideoPlayer } from "@/components/courses/secure-video-player"
import { InternalExam } from "@/components/courses/internal-exam"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { motion, AnimatePresence } from "framer-motion"

export default function LearnPage() {
    const { id } = useParams()
    const router = useRouter()
    const [course, setCourse] = useState<any>(null)
    const [currentLesson, setCurrentLesson] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [progress, setProgress] = useState(0)
    const [submissions, setSubmissions] = useState<any[]>([])
    const [completedLessons, setCompletedLessons] = useState<string[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [isCheckingRestrictions, setIsCheckingRestrictions] = useState(true)
    const [isSidebarHidden, setIsSidebarHidden] = useState(false)
    const [videoStartTime, setVideoStartTime] = useState(0)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (!currentUser) {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [router])

    useEffect(() => {
        async function fetchCourseAndEnrollment() {
            if (!id || !user) return
            try {
                // 0. Fetch profile
                const pDoc = await getDoc(doc(db, "profiles", user.uid))
                if (pDoc.exists()) setProfile(pDoc.data())

                // 1. Check enrollment (Bypass for admin)
                const enrollmentRef = doc(db, "enrollments", `${user.uid}_${id}`)
                const enrollmentSnap = await getDoc(enrollmentRef)

                const isAdmin = pDoc.exists() ? pDoc.data()?.role === 'admin' : false

                if (!enrollmentSnap.exists() && !isAdmin) {
                    router.push(`/restricted-access?reason=course&courseId=${id}`)
                    return
                }

                if (enrollmentSnap.exists()) {
                    const enrollmentData = enrollmentSnap.data()
                    setProgress(enrollmentData.progress || 0)
                    setCompletedLessons(enrollmentData.completed_lessons || [])
                } else {
                    // Admin preview mode
                    setProgress(0)
                    setCompletedLessons([])
                }

                // 2. Fetch course
                const courseRef = doc(db, "courses", id as string)
                const courseSnap = await getDoc(courseRef)

                if (courseSnap.exists()) {
                    const courseData = courseSnap.data()
                    setCourse({ id: courseSnap.id, ...courseData })

                    // Set initial lesson (first module, first lesson)
                    if (courseData.modules?.[0]?.lessons?.[0]) {
                        setCurrentLesson(courseData.modules[0].lessons[0])

                        // Auto-hide sidebar if first lesson is exam/assignment
                        const firstLesson = courseData.modules[0].lessons[0]
                        if (firstLesson?.type === 'exam' || firstLesson?.type === 'assignment') {
                            setIsSidebarHidden(true)
                        }
                    }
                }
                // 3. Listen to submissions in real-time
                const submissionsQ = query(
                    collection(db, "submissions"),
                    where("student_id", "==", user.uid),
                    where("course_id", "==", id as string)
                )

                const unsubSubmissions = onSnapshot(submissionsQ, (snapshot) => {
                    setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
                })

                return () => unsubSubmissions()

            } catch (error) {
                console.error("Error loading learn page:", error)
            } finally {
                setIsLoading(false)
            }
        }
        let unsubSub: any;
        if (user) {
            fetchCourseAndEnrollment().then(cleanup => {
                unsubSub = cleanup
            })
        }
        return () => {
            if (unsubSub) unsubSub()
        }
    }, [id, user, router])

    const isLessonLocked = (lesson: any) => {
        if (!course || !lesson) return false

        // If the course is not tied to a specific grade level, it has no lesson restrictions
        if (!course.grade_level) return false

        const flatLessons = course.modules?.flatMap((m: any) => m.lessons) || []
        const lessonIndex = flatLessons.findIndex((l: any) => l.id === lesson.id)

        // Progressive Locking: Subsequent lessons are blocked until previous Assessments are passed
        for (let i = 0; i < lessonIndex; i++) {
            const prev = flatLessons[i];

            if (prev.type === 'exam' || prev.type === 'assignment') {
                const submission = submissions.find(s => s.lesson_id === prev.id)
                if (!submission) return true
                if (prev.type === 'exam' && (submission.score || 0) < 50) return true
            }
            // Note: Videos and Files do not block the next lesson anymore, 
            // allowing students to access content and exams freely while ensuring 
            // they pass assessments before moving further in the track.
        }

        return false
    }

    const handleLessonComplete = async (lessonId: string) => {
        try {
            // Get current enrollment to see existing completed lessons
            const enrollmentRef = doc(db, "enrollments", `${user.uid}_${id}`)
            const enrollmentSnap = await getDoc(enrollmentRef)

            if (enrollmentSnap.exists()) {
                const data = enrollmentSnap.data()
                const completedLessons = data.completed_lessons || []

                if (!completedLessons.includes(lessonId)) {
                    const newCompleted = [...completedLessons, lessonId]
                    const totalLessons = course?.modules?.flatMap((m: any) => m.lessons).length || 1
                    const newProgress = Math.round((newCompleted.length / totalLessons) * 100)

                    await updateDoc(enrollmentRef, {
                        completed_lessons: newCompleted,
                        progress: newProgress,
                        last_accessed_lesson: lessonId,
                        updated_at: new Date().toISOString()
                    })

                    setCompletedLessons(newCompleted)
                    setProgress(newProgress)
                    toast.success("تم إكمال الدرس وتحديث التقدم!")
                } else {
                    toast.info("هذا الدرس مكتمل بالفعل")
                }
            }
        } catch (error) {
            console.error("Update progress error:", error)
            toast.error("فشل في تحديث التقدم")
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }



    const CourseSidebar = () => (
        <div className="flex flex-col h-full bg-background border-r overflow-y-auto">
            <div className="p-6 border-b">
                <h2 className="font-bold text-lg mb-2 line-clamp-1">{course?.title}</h2>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>التقدم: {progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
            </div>
            <div className="flex-1">
                {course?.modules?.map((module: any, mIdx: number) => (
                    <div key={module.id} className="border-b last:border-0">
                        <div className="bg-muted/30 px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            الوحدة {mIdx + 1}: {module.title}
                        </div>
                        <div className="flex flex-col">
                            {module.lessons?.map((lesson: any, lIdx: number) => {
                                const locked = isLessonLocked(lesson)
                                return (
                                    <button
                                        key={lesson.id}
                                        onClick={() => {
                                            if (locked) {
                                                toast.error("هذا الدرس مغلق. يرجى إكمال الاختبارات/الواجبات السابقة أولاً.")
                                                return
                                            }
                                            setCurrentLesson(lesson)
                                            if (lesson.type === 'exam' || lesson.type === 'assignment') {
                                                setIsSidebarHidden(true)
                                            } else {
                                                setIsSidebarHidden(false)
                                            }

                                            // Auto-close sheet on mobile
                                            setIsSheetOpen(false)

                                            // Fetch video progress if it's a video
                                            if (lesson.type === 'video' || !lesson.type) {
                                                const fetchProgress = async () => {
                                                    try {
                                                        const pRef = doc(db, "video_progress", `${user.uid}_${lesson.id}`)
                                                        const pSnap = await getDoc(pRef)
                                                        if (pSnap.exists()) {
                                                            setVideoStartTime(pSnap.data().current_time || 0)
                                                        } else {
                                                            setVideoStartTime(0)
                                                        }
                                                    } catch (err) {
                                                        console.error("Error fetching video progress:", err)
                                                        setVideoStartTime(0)
                                                    }
                                                }
                                                fetchProgress()
                                            }
                                        }}
                                        className={`flex items-center gap-3 px-6 py-4 text-sm text-right transition-colors hover:bg-muted/50 ${currentLesson?.id === lesson.id ? "bg-primary/5 text-primary border-r-2 border-primary" : ""
                                            } ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                        <div className="shrink-0 flex items-center gap-2">
                                            <div className="relative">
                                                {locked ? (
                                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <>
                                                        {(lesson.type === 'video' || !lesson.type) && <Video className={`h-4 w-4 ${currentLesson?.id === lesson.id ? "animate-pulse" : "text-muted-foreground/50"}`} />}
                                                        {lesson.type === 'file' && <FileText className={`h-4 w-4 ${currentLesson?.id === lesson.id ? "" : "text-muted-foreground/50"}`} />}
                                                        {lesson.type === 'assignment' && <ClipboardList className={`h-4 w-4 ${currentLesson?.id === lesson.id ? "" : "text-muted-foreground/50"}`} />}
                                                        {lesson.type === 'exam' && <HelpCircle className={`h-4 w-4 ${currentLesson?.id === lesson.id ? "" : "text-muted-foreground/50"}`} />}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <span className="flex-1 line-clamp-1">{lesson.title}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="flex h-screen flex-col">
            <Navbar />
            <div className="flex flex-1 overflow-hidden">
                {/* Desktop Sidebar */}
                <AnimatePresence initial={false}>
                    {!isSidebarHidden && (
                        <motion.aside
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="hidden lg:block shrink-0 overflow-hidden"
                        >
                            <div className="w-80 h-full">
                                <CourseSidebar />
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>

                {/* Main View */}
                <main className="flex-1 flex flex-col overflow-y-auto bg-muted/5 relative">
                    {/* Focus Mode Toggle Button (Desktop only) */}
                    <div className="hidden lg:block absolute left-4 top-4 z-30">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-background/80 backdrop-blur border text-[10px] h-8 gap-2 font-bold shadow-sm hover:bg-background"
                            onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                        >
                            <Menu className="h-3.5 w-3.5" />
                            {isSidebarHidden ? 'إظهار القائمة' : 'وضع التركيز (إخفاء القائمة)'}
                        </Button>
                    </div>
                    {/* Top Bar for Mobile */}
                    <div className="lg:hidden flex items-center justify-between p-4 bg-background border-b sticky top-0 z-40">
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="p-0 w-80">
                                <SheetHeader className="sr-only">
                                    <SheetTitle>قائمة الدروس</SheetTitle>
                                </SheetHeader>
                                <CourseSidebar />
                            </SheetContent>
                        </Sheet>
                        <h1 className="text-sm font-bold truncate">{currentLesson?.title}</h1>
                        <div className="w-9"></div> {/* Spacer */}
                    </div>

                    <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-6">
                        {/* Content Viewer Section */}
                        {(currentLesson?.type === 'video' || !currentLesson?.type) && (
                            <SecureVideoPlayer
                                key={`${id}_${currentLesson?.id}`}
                                courseId={course.id}
                                lessonId={currentLesson?.id}
                                userEmail={user?.email}
                                studentId={profile?.student_id || user?.uid}
                                startTime={videoStartTime}
                            />
                        )}

                        {currentLesson?.type === 'file' && (
                            <div className="bg-background border rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[400px]">
                                <div className="h-20 w-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                                    <FileText className="h-10 w-10" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold">{currentLesson.title}</h2>
                                    <p className="text-muted-foreground">هذا المحتوى عباره عن ملف مرجعي أو ملخص للدرس.</p>
                                </div>
                                <Button className="gap-2" size="lg" asChild>
                                    <a href={currentLesson.url} target="_blank" rel="noopener noreferrer">
                                        <PlayCircle className="h-5 w-5" />
                                        فتح الملف / تحميل
                                    </a>
                                </Button>
                            </div>
                        )}

                        {currentLesson?.type === 'assignment' && (
                            <div className="bg-background border rounded-xl p-8 md:p-12 space-y-8 shadow-sm min-h-[400px]">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                        <ClipboardList className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{currentLesson.title}</h2>
                                        <Badge variant="outline" className="mt-1">واجب منزلي</Badge>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg">تعليمات الواجب:</h3>
                                    <div className="bg-muted/30 p-6 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                                        {currentLesson.instructions || "لا توجد تعليمات إضافية لهذا الواجب."}
                                    </div>
                                </div>

                                {currentLesson.questions && currentLesson.questions.length > 0 ? (
                                    <div className="pt-4">
                                        <InternalExam
                                            courseId={id as string}
                                            lessonId={currentLesson.id}
                                            examData={{
                                                title: "واجب: " + currentLesson.title,
                                                description: currentLesson.instructions || "",
                                                duration: "60", // Default 60 mins for assignments
                                                questions: currentLesson.questions
                                            }}
                                            type="assignment"
                                            initialSubmission={course.grade_level ? submissions.find(s => s.lesson_id === currentLesson.id) : null}
                                            onComplete={async (score) => {
                                                await handleLessonComplete(currentLesson.id)
                                                // Refresh submissions in LearnPage
                                                async function fetchNewSubs() {
                                                    const subsQ = query(
                                                        collection(db, "submissions"),
                                                        where("student_id", "==", user.uid),
                                                        where("course_id", "==", id)
                                                    )
                                                    const subsSnap = await getDocs(subsQ)
                                                    setSubmissions(subsSnap.docs.map(doc => doc.data()))
                                                }
                                                fetchNewSubs()
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="pt-4 flex flex-col md:flex-row gap-4">
                                        <Button className="flex-1 h-12 text-lg">رفع الحل (قريباً)</Button>
                                        <Button variant="outline" className="flex-1 h-12 text-lg">تواصل مع المدرس</Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentLesson?.type === 'exam' && (
                            <InternalExam
                                courseId={course.id}
                                lessonId={currentLesson.id}
                                examData={{
                                    title: currentLesson.title,
                                    description: currentLesson.description || "اختبار تقييمي للمستوى",
                                    duration: currentLesson.duration || "60",
                                    questions: currentLesson.questions || []
                                }}
                                type="exam"
                                initialSubmission={course.grade_level ? submissions.find(s => s.lesson_id === currentLesson.id) : null}
                                onComplete={(score) => {
                                    handleLessonComplete(currentLesson.id)
                                    // Refresh submissions to unlock next
                                    const fetchNewSubs = async () => {
                                        const submissionsQ = query(
                                            collection(db, "submissions"),
                                            where("student_id", "==", user.uid),
                                            where("course_id", "==", course.id)
                                        )
                                        const subsSnap = await getDocs(submissionsQ)
                                        setSubmissions(subsSnap.docs.map(doc => doc.data()))
                                    }
                                    fetchNewSubs()
                                }}
                            />
                        )}

                        {/* Lesson Info */}
                        <div className="bg-background border rounded-xl p-6 md:p-8 space-y-6 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-bold">{currentLesson?.title}</h1>
                                    <p className="text-muted-foreground text-sm">من وحدة: {course?.modules?.find((m: any) => m.lessons.some((l: any) => l.id === currentLesson?.id))?.title}</p>
                                </div>
                                <Button
                                    className="gap-2"
                                    onClick={() => handleLessonComplete(currentLesson?.id)}
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    إكمال ومتابعة
                                </Button>
                            </div>


                            {/* Assignments Section */}
                            {currentLesson?.assignments?.length > 0 && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-bold flex items-center gap-2 text-primary">
                                        <ClipboardList className="h-4 w-4" />
                                        الواجبات المطلوبة
                                    </h3>
                                    <div className="grid gap-3">
                                        {currentLesson.assignments.map((asgn: any) => (
                                            <div key={asgn.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-primary/10">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs italic">W</div>
                                                    <span className="font-medium">{asgn.title}</span>
                                                </div>
                                                <Button size="sm" variant="outline">بدء الواجب</Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Exams Section */}
                            {currentLesson?.exams?.length > 0 && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-bold flex items-center gap-2 text-destructive">
                                        <HelpCircle className="h-4 w-4" />
                                        الامتحانات الشاملة
                                    </h3>
                                    <div className="grid gap-3">
                                        {currentLesson.exams.map((exam: any) => (
                                            <div key={exam.id} className="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/10">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center font-bold text-xs italic">E</div>
                                                    <div>
                                                        <p className="font-medium">{exam.title}</p>
                                                        <p className="text-[10px] text-muted-foreground font-arabic">المدة: {exam.duration || 60} دقيقة</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="destructive" className="font-bold">دخول الامتحان</Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                        const flatLessons = course?.modules?.flatMap((m: any) => m.lessons) || []
                                        const currentIndex = flatLessons.findIndex((l: any) => l.id === currentLesson?.id)
                                        if (currentIndex > 0) {
                                            setCurrentLesson(flatLessons[currentIndex - 1])
                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                        }
                                    }}
                                    disabled={!course?.modules?.flatMap((m: any) => m.lessons).findIndex((l: any) => l.id === currentLesson?.id)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                    الدرس السابق
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10"
                                    onClick={async () => {
                                        const flatLessons = course?.modules?.flatMap((m: any) => m.lessons) || []
                                        const currentIndex = flatLessons.findIndex((l: any) => l.id === currentLesson?.id)

                                        // Auto-complete current lesson if it's not an assessment (to avoid scoring issues here)
                                        if (currentLesson?.type !== 'exam' && currentLesson?.type !== 'assignment') {
                                            await handleLessonComplete(currentLesson?.id)
                                        }

                                        if (currentIndex < flatLessons.length - 1) {
                                            const nextLesson = flatLessons[currentIndex + 1]
                                            if (isLessonLocked(nextLesson)) {
                                                toast.error("هذا الدرس مغلق. يرجى إكمال الاختبارات/الواجبات السابقة أولاً.")
                                                return
                                            }
                                            setCurrentLesson(nextLesson)
                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                        }
                                    }}
                                    disabled={course?.modules?.flatMap((m: any) => m.lessons).findIndex((l: any) => l.id === currentLesson?.id) === (course?.modules?.flatMap((m: any) => m.lessons).length - 1)}
                                >
                                    الدرس التالي (إكمال ومتابعة)
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
