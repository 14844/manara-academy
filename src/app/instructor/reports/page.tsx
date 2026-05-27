"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc, addDoc, deleteDoc, updateDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
    Users,
    BookOpen,
    Loader2,
    Calendar,
    Award,
    CheckCircle2,
    BarChart3,
    Search,
    ExternalLink,
    Copy,
    Share2,
    Trash2,
    MessageSquare,
    Mail,
    Settings,
    FileText,
    Clock,
    Plus,
    Check,
    AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useSupportSettings } from "@/hooks/use-support-settings"

const DAYS_OF_WEEK = [
    { value: "saturday", label: "السبت" },
    { value: "sunday", label: "الأحد" },
    { value: "monday", label: "الإثنين" },
    { value: "tuesday", label: "الثلاثاء" },
    { value: "wednesday", label: "الأربعاء" },
    { value: "thursday", label: "الخميس" },
    { value: "friday", label: "الجمعة" },
]

export default function InstructorReportsPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [courses, setCourses] = useState<any[]>([])
    const [selectedCourseId, setSelectedCourseId] = useState<string>("")
    const [students, setStudents] = useState<any[]>([])
    const [isStudentsLoading, setIsStudentsLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // Sent reports log state
    const [sentReports, setSentReports] = useState<any[]>([])
    const [isLogLoading, setIsLogLoading] = useState(false)

    // Create report state
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
    const [manualNote, setManualNote] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)

    // Result dialog state
    const [generatedLink, setGeneratedLink] = useState("")
    const [isResultOpen, setIsResultOpen] = useState(false)

    // Scheduling state
    const [schedules, setSchedules] = useState<Record<string, any>>({})
    const [isScheduleSaving, setIsScheduleSaving] = useState<Record<string, boolean>>({})
    const [pendingScheduledReports, setPendingScheduledReports] = useState<any[]>([])
    const [isPendingLoading, setIsPendingLoading] = useState(false)
    const [instructorProfile, setInstructorProfile] = useState<any>(null)
    const { settings: supportSettings } = useSupportSettings()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser)
                // Fetch profile to verify if scheduling is unlocked
                try {
                    const profileDoc = await getDoc(doc(db, "profiles", currentUser.uid))
                    if (profileDoc.exists()) {
                        setInstructorProfile(profileDoc.data())
                    }
                } catch (error) {
                    console.error("Error fetching instructor profile:", error)
                }
                fetchCourses(currentUser.uid)
                fetchSentReports(currentUser.uid)
                fetchSchedules(currentUser.uid)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        if (selectedCourseId) {
            fetchStudents(selectedCourseId)
        } else {
            setStudents([])
        }
    }, [selectedCourseId])

    // Fetch all courses by this instructor
    async function fetchCourses(instructorId: string) {
        setIsLoading(true)
        try {
            const q = query(collection(db, "courses"), where("instructor_id", "==", instructorId))
            const snap = await getDocs(q)
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setCourses(list)
            if (list.length > 0) {
                setSelectedCourseId(list[0].id)
            }
        } catch (error) {
            console.error("Error fetching courses:", error)
            toast.error("فشل في تحميل الكورسات")
        } finally {
            setIsLoading(false)
        }
    }

    // Fetch students enrolled in the selected course
    async function fetchStudents(courseId: string) {
        setIsStudentsLoading(true)
        try {
            // Get all enrollments for this course
            const q = query(collection(db, "enrollments"), where("course_id", "==", courseId))
            const snap = await getDocs(q)
            const enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() as any }))

            if (enrollments.length === 0) {
                setStudents([])
                setIsStudentsLoading(false)
                return
            }

            // Get course total lessons from selected course data
            const courseData = courses.find(c => c.id === courseId)
            const totalLessons = courseData?.modules?.reduce((acc: number, mod: any) => acc + (mod.lessons?.length || 0), 0) || 0

            // Fetch student profiles and submissions
            const studentsData = await Promise.all(enrollments.map(async (enr) => {
                const profileDoc = await getDoc(doc(db, "profiles", enr.student_id))
                const profile = profileDoc.exists() ? profileDoc.data() : {}

                // Fetch student submissions for this course
                const subsQ = query(
                    collection(db, "submissions"),
                    where("student_id", "==", enr.student_id),
                    where("course_id", "==", courseId)
                )
                const subsSnap = await getDocs(subsQ)
                const submissions = subsSnap.docs.map(d => d.data())

                return {
                    id: enr.student_id,
                    name: profile.full_name || enr.student_name || "طالب غير معروف",
                    email: profile.email || "غير متوفر",
                    phone: profile.phone || "غير متوفر",
                    parentPhone: profile.parent_phone || "",
                    avatar: profile.avatar_url || null,
                    progress: enr.progress || 0,
                    completedLessons: enr.completed_lessons?.length || 0,
                    totalLessons: totalLessons,
                    lastAccessed: enr.last_accessed || null,
                    submissions: submissions,
                    enrollmentId: enr.id
                }
            }))

            setStudents(studentsData)
        } catch (error) {
            console.error("Error fetching students:", error)
            toast.error("فشل في تحميل الطلاب المسجلين")
        } finally {
            setIsStudentsLoading(false)
        }
    }

    // Fetch previously sent reports
    async function fetchSentReports(instructorId: string) {
        setIsLogLoading(true)
        try {
            const q = query(
                collection(db, "parent_reports"),
                where("instructor_id", "==", instructorId)
            )
            const snap = await getDocs(q)
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            // Sort by created_at desc
            list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            setSentReports(list)
        } catch (error) {
            console.error("Error fetching sent reports:", error)
        } finally {
            setIsLogLoading(false)
        }
    }

    // Fetch schedules
    async function fetchSchedules(instructorId: string) {
        try {
            const q = query(collection(db, "report_schedules"), where("instructor_id", "==", instructorId))
            const snap = await getDocs(q)
            const map: Record<string, any> = {}
            snap.docs.forEach(d => {
                map[d.data().course_id] = { id: d.id, ...d.data() }
            })
            setSchedules(map)
            calculatePendingScheduled(map, instructorId)
        } catch (error) {
            console.error("Error fetching schedules:", error)
        }
    }

    // Calculate due scheduled reports for today
    async function calculatePendingScheduled(schedulesMap: Record<string, any>, instructorId: string) {
        setIsPendingLoading(true)
        try {
            const daysMap: Record<number, string> = {
                0: "sunday",
                1: "monday",
                2: "tuesday",
                3: "wednesday",
                4: "thursday",
                5: "friday",
                6: "saturday",
            }
            const todayDay = daysMap[new Date().getDay()]
            const currentYear = new Date().getFullYear()
            // Get week number
            const currentJan1 = new Date(currentYear, 0, 1)
            const numberOfDays = Math.floor((new Date().getTime() - currentJan1.getTime()) / (24 * 60 * 60 * 1000))
            const currentWeekString = `${currentYear}-W${Math.ceil((numberOfDays + currentJan1.getDay() + 1) / 7)}`

            const activeSchedules = Object.values(schedulesMap).filter(s => s.enabled && s.day_of_week === todayDay)

            if (activeSchedules.length === 0) {
                setPendingScheduledReports([])
                setIsPendingLoading(false)
                return
            }

            const pendingList: any[] = []

            for (const sched of activeSchedules) {
                // Get all enrollments for this course
                const eq = query(collection(db, "enrollments"), where("course_id", "==", sched.course_id))
                const esnap = await getDocs(eq)
                const enrollments = esnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

                const courseDoc = await getDoc(doc(db, "courses", sched.course_id))
                const courseData = courseDoc.exists() ? courseDoc.data() : {}
                const totalLessons = courseData.modules?.reduce((acc: number, mod: any) => acc + (mod.lessons?.length || 0), 0) || 0

                for (const enr of enrollments) {
                    const profileDoc = await getDoc(doc(db, "profiles", enr.student_id))
                    const profile = profileDoc.exists() ? profileDoc.data() : {}

                    // Check if parent phone is present
                    if (!profile.parent_phone) continue

                    // Check if a report was already sent this week for this course and student
                    // Avoid sending twice in the same week
                    const alreadySentQ = query(
                        collection(db, "parent_reports"),
                        where("student_id", "==", enr.student_id),
                        where("course_id", "==", sched.course_id)
                    )
                    const alreadySentSnap = await getDocs(alreadySentQ)
                    const thisWeekReport = alreadySentSnap.docs.find(d => {
                        const cDate = new Date(d.data().created_at)
                        const jan1 = new Date(cDate.getFullYear(), 0, 1)
                        const days = Math.floor((cDate.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000))
                        const weekStr = `${cDate.getFullYear()}-W${Math.ceil((days + jan1.getDay() + 1) / 7)}`
                        return weekStr === currentWeekString
                    })

                    if (thisWeekReport) continue

                    // Get submissions
                    const subsQ = query(
                        collection(db, "submissions"),
                        where("student_id", "==", enr.student_id),
                        where("course_id", "==", sched.course_id)
                    )
                    const subsSnap = await getDocs(subsQ)
                    const submissions = subsSnap.docs.map(d => d.data())

                    pendingList.push({
                        studentId: enr.student_id,
                        studentName: profile.full_name || enr.student_name,
                        studentAvatar: profile.avatar_url || null,
                        parentPhone: profile.parent_phone,
                        courseId: sched.course_id,
                        courseTitle: courseData.title || "كورس",
                        progress: enr.progress || 0,
                        completedLessons: enr.completed_lessons?.length || 0,
                        totalLessons: totalLessons,
                        lastAccessed: enr.last_accessed || null,
                        submissions: submissions,
                        scheduleId: sched.id,
                        instructorId: instructorId
                    })
                }
            }

            setPendingScheduledReports(pendingList)
        } catch (error) {
            console.error("Error calculating pending scheduled reports:", error)
        } finally {
            setIsPendingLoading(false)
        }
    }

    // Toggle and Save schedule settings for a course
    async function handleSaveSchedule(courseId: string, day: string, time: string, enabled: boolean) {
        if (!user) return
        setIsScheduleSaving(prev => ({ ...prev, [courseId]: true }))
        try {
            const scheduleId = schedules[courseId]?.id || `${courseId}_schedule`
            const scheduleRef = doc(db, "report_schedules", scheduleId)

            const payload = {
                id: scheduleId,
                course_id: courseId,
                instructor_id: user.uid,
                day_of_week: day,
                time: time,
                enabled: enabled,
                updated_at: new Date().toISOString()
            }

            await setDoc(scheduleRef, payload, { merge: true })
            setSchedules(prev => ({
                ...prev,
                [courseId]: payload
            }))
            toast.success("تم حفظ إعدادات الجدولة الزمنية بنجاح!")
            calculatePendingScheduled({ ...schedules, [courseId]: payload }, user.uid)
        } catch (error) {
            console.error("Error saving schedule:", error)
            toast.error("فشل في حفظ إعدادات الجدولة")
        } finally {
            setIsScheduleSaving(prev => ({ ...prev, [courseId]: false }))
        }
    }

    // Trigger report creation side panel
    const triggerCreateReport = (student: any) => {
        setSelectedStudent(student)
        setManualNote("")
        setIsCreateSheetOpen(true)
    }

    // Generate report (compile snapshot & save)
    const handleGenerateReport = async (studentDataInput?: any) => {
        const student = studentDataInput || selectedStudent
        if (!student || !user) return

        setIsGenerating(true)
        try {
            // Fetch instructor profile to get name and avatar
            const instructorDoc = await getDoc(doc(db, "profiles", user.uid))
            const instructorProfile = instructorDoc.exists() ? instructorDoc.data() : {}

            const courseData = courses.find(c => c.id === student.courseId || c.id === selectedCourseId)

            // Gather exams and query highest class score
            const examsList = []
            const submissions = student.submissions || []

            for (const sub of submissions) {
                // Find matching lesson title in course modules
                let lessonTitle = "اختبار"
                if (courseData && courseData.modules) {
                    const lesson = courseData.modules
                        .flatMap((m: any) => m.lessons || [])
                        .find((l: any) => String(l.id) === String(sub.lesson_id))
                    if (lesson) lessonTitle = lesson.title
                }

                // Query highest score in class for this lesson exam
                const allSubsForLessonQ = query(
                    collection(db, "submissions"),
                    where("course_id", "==", courseData.id),
                    where("lesson_id", "==", sub.lesson_id)
                )
                const allSubsSnap = await getDocs(allSubsForLessonQ)
                const maxScore = allSubsSnap.docs.reduce((max, d) => {
                    const s = d.data().score || 0
                    return s > max ? s : max
                }, 0)

                examsList.push({
                    id: sub.lesson_id || "",
                    title: lessonTitle,
                    score: sub.score || 0,
                    highest_score: maxScore > 0 ? maxScore : (sub.score || 0),
                    submitted_at: sub.submitted_at?.seconds 
                        ? new Date(sub.submitted_at.seconds * 1000).toISOString() 
                        : new Date().toISOString()
                })
            }

            // Calculate overall average score
            const avgScore = submissions.length > 0
                ? Math.round(submissions.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / submissions.length)
                : 0

            // Expiry date (30 days from now)
            const expiry = new Date()
            expiry.setDate(expiry.getDate() + 30)

            const reportPayload = {
                student_id: student.id || student.studentId,
                student_name: student.name || student.studentName,
                student_avatar: student.avatar || student.studentAvatar || null,
                instructor_id: user.uid,
                instructor_name: instructorProfile.full_name || "معلم المنارة",
                instructor_avatar: instructorProfile.avatar_url || null,
                course_id: courseData.id,
                course_title: courseData.title || "كورس",
                created_at: new Date().toISOString(),
                expires_at: expiry.toISOString(),
                manual_note: studentDataInput ? "تقرير مجدول أسبوعي تلقائي" : manualNote,
                stats: {
                    attendance_rate: student.totalLessons > 0 
                        ? Math.round((student.completedLessons / student.totalLessons) * 100) 
                        : 0,
                    completed_lessons_count: student.completedLessons,
                    total_lessons_count: student.totalLessons,
                    last_accessed: student.lastAccessed,
                    progress: student.progress,
                    average_score: avgScore
                },
                exams: examsList
            }

            // Generate report in parent_reports
            const docRef = await addDoc(collection(db, "parent_reports"), reportPayload)

            // Update log list
            const newReport = { id: docRef.id, ...reportPayload }
            setSentReports(prev => [newReport, ...prev])

            const magicUrl = window.location.origin + "/report/" + docRef.id
            setGeneratedLink(magicUrl)

            setIsCreateSheetOpen(false)
            setManualNote("")
            setIsResultOpen(true)
            toast.success("تم توليد التقرير بنجاح! 📈")

            // If it was from scheduled tab, remove it from the pending UI list
            if (studentDataInput) {
                setPendingScheduledReports(prev => prev.filter(p => !(p.studentId === student.studentId && p.courseId === student.courseId)))
            }

            return magicUrl
        } catch (error) {
            console.error("Error generating report:", error)
            toast.error("فشل في توليد التقرير")
        } finally {
            setIsGenerating(false)
        }
    }

    // Delete a generated report
    const handleDeleteReport = async (reportId: string) => {
        if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا التقرير وإلغاء صلاحية الوصول إليه فوراً؟")) return

        try {
            await deleteDoc(doc(db, "parent_reports", reportId))
            setSentReports(prev => prev.filter(r => r.id !== reportId))
            toast.success("تم حذف التقرير بنجاح وإلغاء صلاحية الرابط السحري.")
        } catch (error) {
            console.error("Delete report error:", error)
            toast.error("حدث خطأ أثناء حذف التقرير")
        }
    }

    // Helper to format Date Arabic
    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    }

    // Helper for WhatsApp URL
    const getWhatsAppUrl = (phone: string, studentName: string, courseTitle: string, link: string) => {
        // Sanitize phone
        let cleanPhone = phone.replace(/[^0-9]/g, "")
        if (cleanPhone.startsWith("01")) {
            cleanPhone = "2" + cleanPhone // Egypt code prefix
        }
        const text = `السلام عليكم، هذا تقرير متابعة مستوى الطالب ${studentName} في كورس ${courseTitle}. يمكنك الاطلاع عليه وعلى الدرجات والتقدم الدراسي من خلال الرابط السري التالي: \n${link}`
        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    }

    // Helper for Email link
    const getEmailUrl = (email: string, studentName: string, courseTitle: string, link: string) => {
        const subject = `تقرير متابعة مستوى الطالب: ${studentName}`
        const body = `السلام عليكم ورحمة الله وبركاته،\n\nنود إفادتكم بتقرير دراسي مفصل لمتابعة حضور ودرجات وتقدم الطالب (${studentName}) في كورس (${courseTitle}).\n\nيمكنكم عرض التقرير كاملاً والدرجات بشكل تفاعلي ومباشر عبر الضغط على الرابط السري أدناه (صالح لمدة 30 يوماً):\n${link}\n\nمع خالص التقدير،\nأكاديمية المنارة`
        return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500 pb-16">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-primary" />
                        تقارير أولياء الأمور
                    </h1>
                    <p className="text-muted-foreground mt-1 italic">قم بإصدار ومشاركة تقارير أداء ومستوى تفاعلية لأولياء الأمور لتتبع أداء أبنائهم.</p>
                </div>
            </div>

            <Tabs defaultValue="active-reports" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-xl h-12 bg-muted/40 p-1 rounded-2xl mb-8">
                    <TabsTrigger value="active-reports" className="rounded-xl font-bold text-sm">التقارير الحالية</TabsTrigger>
                    <TabsTrigger value="sent-reports" className="rounded-xl font-bold text-sm">سجل التقارير المرسلة</TabsTrigger>
                    <TabsTrigger value="auto-schedule" className="rounded-xl font-bold text-sm">الجدولة التلقائية</TabsTrigger>
                </TabsList>

                {/* TAB 1: ACTIVE REPORTS CREATION */}
                <TabsContent value="active-reports" className="space-y-6">
                    <Card className="border-2 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/10 pb-4 border-b">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1.5 flex-1">
                                    <CardTitle className="text-lg font-bold">توليد تقرير فردي أو جماعي</CardTitle>
                                    <CardDescription className="text-xs font-bold text-muted-foreground">اختر الكورس التعليمي لمشاهدة طلابك والبدء في تصدير تقارير المتابعة.</CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 shrink-0">
                                    <div className="w-64">
                                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                                            <SelectTrigger className="h-11 rounded-xl border-zinc-300">
                                                <SelectValue placeholder="اختر الكورس..." />
                                            </SelectTrigger>
                                            <SelectContent className="font-arabic">
                                                {courses.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {selectedCourseId && (
                                        <Button size="lg" className="rounded-xl font-bold gap-2 h-11 shadow-md shadow-primary/10" asChild>
                                            <Link href={`/instructor/reports/class/${selectedCourseId}`}>
                                                <BarChart3 className="h-4 w-4" />
                                                تقرير كامل الصف
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {selectedCourseId ? (
                                <div className="space-y-6">
                                    <div className="relative w-full md:w-80 mr-auto">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="ابحث بالاسم أو البريد..."
                                            className="pr-10 h-10 border-zinc-200"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {isStudentsLoading ? (
                                        <div className="flex py-20 items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : filteredStudents.length === 0 ? (
                                        <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-muted/10">
                                            <Users className="h-12 w-12 text-muted-foreground mx-auto opacity-20 mb-3" />
                                            <h4 className="font-bold text-muted-foreground text-lg">لم يتم العثور على أي طلاب</h4>
                                            <p className="text-xs text-muted-foreground">تأكد من وجود طلاب مشتركين في هذا الكورس، أو قم بتغيير كلمات البحث.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {filteredStudents.map((student) => (
                                                <Card key={student.id} className="border-2 border-zinc-100 hover:border-primary/30 hover:shadow-md transition-all">
                                                    <CardContent className="p-6 space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden border">
                                                                {student.avatar ? (
                                                                    <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    student.name.charAt(0)
                                                                )}
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <h4 className="font-black text-base truncate">{student.name}</h4>
                                                                <span className="text-[10px] text-muted-foreground font-bold truncate block">{student.email}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2 pt-2 border-t text-xs">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-muted-foreground font-bold">نسبة التقدم:</span>
                                                                <span className="font-black text-primary">{student.progress}%</span>
                                                            </div>
                                                            <Progress value={student.progress} className="h-1.5" />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 text-xs font-bold pt-2">
                                                            <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 flex flex-col gap-1 items-center text-center">
                                                                <span className="text-muted-foreground text-[10px]">المحاضرات</span>
                                                                <span className="text-sm font-black">{student.completedLessons} / {student.totalLessons}</span>
                                                            </div>
                                                            <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 flex flex-col gap-1 items-center text-center">
                                                                <span className="text-muted-foreground text-[10px]">متوسط الدرجات</span>
                                                                <span className="text-sm font-black text-green-700">
                                                                    {student.submissions.length > 0
                                                                        ? `${Math.round(student.submissions.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / student.submissions.length)}%`
                                                                        : "٠%"
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="text-[10px] text-muted-foreground font-bold flex justify-between items-center bg-zinc-50/50 p-2 rounded-lg">
                                                            <span>هاتف ولي الأمر:</span>
                                                            <span className="font-bold text-zinc-700">{student.parentPhone || <span className="text-red-400 italic font-medium">غير متوفر</span>}</span>
                                                        </div>

                                                        <Button className="w-full font-bold h-11 rounded-xl shadow-sm" onClick={() => triggerCreateReport(student)}>
                                                            <Plus className="ml-1.5 h-4 w-4" />
                                                            إنشاء تقرير للمستوى
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-20">
                                    <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="font-bold text-muted-foreground">برجاء إنشاء أو اختيار كورس تعليمي للبدء في توليد التقارير.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: SENT REPORTS HISTORY LOG */}
                <TabsContent value="sent-reports" className="space-y-6">
                    <Card className="border-2 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/10 pb-4 border-b">
                            <CardTitle className="text-lg font-bold">سجل التقارير الصادرة</CardTitle>
                            <CardDescription className="text-xs font-bold text-muted-foreground">قائمة بجميع التقارير السابقة التي قمت بمشاركتها مع أولياء الأمور مع إمكانية إدارتها.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isLogLoading ? (
                                <div className="flex py-20 items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : sentReports.length === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/10">
                                    <Clock className="h-12 w-12 text-muted-foreground mx-auto opacity-20 mb-3" />
                                    <h4 className="font-bold text-muted-foreground text-lg">لا يوجد تقارير مرسلة مسبقاً</h4>
                                    <p className="text-xs text-muted-foreground">قم بإصدار أول تقرير دراسي للبدء في تتبع السجل من هنا.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border-2 rounded-xl">
                                    <Table className="font-arabic min-w-full">
                                        <TableHeader className="bg-zinc-50 border-b">
                                            <TableRow>
                                                <TableHead className="text-right font-black text-zinc-700">الطالب</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">الكورس</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">تاريخ الإنشاء</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">تاريخ الانتهاء</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">الحالة</TableHead>
                                                <TableHead className="text-center font-black text-zinc-700">الإجراءات والمشاركة</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sentReports.map((report) => {
                                                const isExpired = new Date(report.expires_at).getTime() < new Date().getTime()
                                                const magicLink = window.location.origin + "/report/" + report.id

                                                return (
                                                    <TableRow key={report.id} className="hover:bg-zinc-50/50">
                                                        <TableCell className="font-bold py-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs overflow-hidden border">
                                                                    {report.student_avatar ? (
                                                                        <img src={report.student_avatar} className="w-full h-full object-cover" alt="" />
                                                                    ) : (
                                                                        report.student_name.charAt(0)
                                                                    )}
                                                                </div>
                                                                <span>{report.student_name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-bold text-zinc-600">{report.course_title}</TableCell>
                                                        <TableCell className="text-xs font-bold tabular-nums text-muted-foreground">{formatDate(report.created_at)}</TableCell>
                                                        <TableCell className="text-xs font-bold tabular-nums text-muted-foreground">{formatDate(report.expires_at)}</TableCell>
                                                        <TableCell>
                                                            {isExpired ? (
                                                                <Badge variant="secondary" className="bg-red-50 text-red-600 border border-red-200">منتهي</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">فعال</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Button size="sm" variant="outline" className="h-9 px-3 gap-1 text-xs border-zinc-200" asChild>
                                                                    <a href={`/report/${report.id}`} target="_blank" rel="noreferrer">
                                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                                        عرض
                                                                    </a>
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    className="h-9 px-3 gap-1 text-xs border-zinc-200" 
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(magicLink)
                                                                        toast.success("تم نسخ الرابط السحري بنجاح!")
                                                                    }}
                                                                >
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                    نسخ
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="h-9 px-3 gap-1 text-xs border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/5" asChild>
                                                                    <a href={getWhatsAppUrl("", report.student_name, report.course_title, magicLink)} target="_blank" rel="noreferrer">
                                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                                        واتساب
                                                                    </a>
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="h-9 px-3 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => handleDeleteReport(report.id)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: WA.ME AUTOMATIC SCHEDULER */}
                <TabsContent value="auto-schedule" className="space-y-8 animate-in fade-in duration-300">
                    {!instructorProfile?.auto_report_unlocked ? (
                        <div className="flex flex-col items-center justify-center text-center p-10 md:p-16 border-2 border-dashed border-zinc-200 rounded-3xl bg-white/40 backdrop-blur-md max-w-2xl mx-auto space-y-6 shadow-xl">
                            <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-primary/10 to-primary/20 border border-primary/20 flex items-center justify-center text-primary shadow-inner relative overflow-hidden">
                                <span className="absolute -top-5 -right-5 h-16 w-16 bg-primary/5 rounded-full blur-xl"></span>
                                <Settings className="h-10 w-10 animate-pulse text-primary" />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-black text-zinc-800">الجدولة التلقائية للتقرير الأسبوعي 🔒</h3>
                                <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                                    هذه ميزة احترافية تتيح لك جدولة تقارير أداء أسبوعية تلقائية متكاملة لجميع طلابك وإرسالها مجمعة بنقرة زر واحدة عبر واتساب (wa.me) بشكل منظم وبدون تعب.
                                </p>
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-xs font-black text-primary max-w-md mx-auto space-y-2">
                                    <div className="text-amber-600 font-extrabold text-sm">⚠️ هذه الميزة مغلقة حالياً.</div>
                                    <div className="text-zinc-600 dark:text-zinc-300 font-bold">
                                        لتفعيل الميزة على حسابك وبدء استخدام الجدولة التلقائية فوراً، يرجى التواصل مع الإدارة أو الدعم الفني.
                                    </div>
                                    <div className="pt-2 border-t border-primary/10 flex flex-col sm:flex-row justify-center items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                                        <span>رقم الدعم الفني المعتمد:</span>
                                        <span className="font-mono font-bold text-primary select-all text-sm">+{supportSettings?.phone || "201017333215"}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-2">
                                <Button 
                                    className="rounded-xl font-bold px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 gap-2 transition-all hover:scale-[1.02]" 
                                    asChild
                                >
                                    <a 
                                        href={`https://wa.me/${supportSettings?.phone || "201017333215"}?text=${encodeURIComponent(`السلام عليكم يا هندسة، أنا المعلم ${instructorProfile?.full_name || user?.displayName || ""} وأرغب في تفعيل ميزة الجدولة التلقائية (Auto Report Scheduler) لتقارير الطلاب في حسابي.`)}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                    >
                                        <MessageSquare className="h-5 w-5" />
                                        تواصل مع الدعم للتفعيل 💳
                                    </a>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Configuration Sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="border-2 shadow-sm overflow-hidden">
                                <CardHeader className="bg-primary/5 pb-4 border-b">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <Settings className="h-5 w-5 text-primary" />
                                        إعدادات الجدولة الأسبوعية
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <p className="text-xs text-muted-foreground leading-relaxed font-bold">قم بضبط تفعيل التقرير التلقائي الأسبوعي لكل كورس. سيقوم النظام بحساب الطلاب المستحقين للتقرير وتجهيزهم في جدول الإرسال مجاناً.</p>

                                    <div className="divide-y space-y-4">
                                        {courses.map((course) => {
                                            const schedule = schedules[course.id] || { day_of_week: "saturday", time: "20:00", enabled: false }
                                            const isSaving = isScheduleSaving[course.id] || false

                                            return (
                                                <div key={course.id} className="pt-4 first:pt-0 space-y-4">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-black text-sm truncate">{course.title}</span>
                                                        <Switch
                                                            checked={schedule.enabled}
                                                            disabled={isSaving}
                                                            onCheckedChange={(checked) => handleSaveSchedule(course.id, schedule.day_of_week, schedule.time, checked)}
                                                        />
                                                    </div>

                                                    {schedule.enabled && (
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] font-bold text-muted-foreground">يوم الإرسال</Label>
                                                                <Select
                                                                    value={schedule.day_of_week}
                                                                    disabled={isSaving}
                                                                    onValueChange={(val) => handleSaveSchedule(course.id, val, schedule.time, schedule.enabled)}
                                                                >
                                                                    <SelectTrigger className="h-9">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="font-arabic">
                                                                        {DAYS_OF_WEEK.map(d => (
                                                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] font-bold text-muted-foreground">وقت الإرسال</Label>
                                                                <Input
                                                                    type="time"
                                                                    className="h-9"
                                                                    value={schedule.time}
                                                                    disabled={isSaving}
                                                                    onChange={(e) => handleSaveSchedule(course.id, schedule.day_of_week, e.target.value, schedule.enabled)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Scheduler Pending List */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="border-2 shadow-sm overflow-hidden">
                                <CardHeader className="bg-muted/10 pb-4 border-b">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="text-lg font-bold">مجدول واتساب (wa.me) للرسائل المستحقة</CardTitle>
                                            <CardDescription className="text-xs font-bold text-muted-foreground">التقارير الدراسية الأسبوعية التي حان موعدها اليوم والجاهزة للإرسال فوراً بضغطة زر واحدة مجانية.</CardDescription>
                                        </div>
                                        <Badge className="bg-zinc-800 text-[10px] px-3.5 py-1 font-bold">{pendingScheduledReports.length} معلقة</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {isPendingLoading ? (
                                        <div className="flex py-20 items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : pendingScheduledReports.length === 0 ? (
                                        <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/10">
                                            <CheckCircle2 className="h-12 w-12 text-green-500/40 mx-auto mb-3" />
                                            <h4 className="font-bold text-muted-foreground text-lg">لا توجد رسائل معلقة لليوم</h4>
                                            <p className="text-xs text-muted-foreground">جميع التقارير الأسبوعية للطلاب تم مشاركتها بنجاح أو لم يحن موعد إرسالها بعد.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y space-y-4">
                                            {pendingScheduledReports.map((item, idx) => (
                                                <div key={idx} className="pt-4 first:pt-0 flex flex-col md:flex-row items-center justify-between gap-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden border">
                                                            {item.studentAvatar ? (
                                                                <img src={item.studentAvatar} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                item.studentName.charAt(0)
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h4 className="font-black text-sm">{item.studentName}</h4>
                                                            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground">
                                                                <span className="bg-muted px-2 py-0.5 rounded">{item.courseTitle}</span>
                                                                <span className="bg-muted px-2 py-0.5 rounded">رقم ولي الأمر: {item.parentPhone}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-xs font-bold">
                                                        <div className="text-center shrink-0">
                                                            <span className="text-muted-foreground text-[10px] block">تقدم الكورس</span>
                                                            <span className="font-black">{item.progress}%</span>
                                                        </div>
                                                        <Button 
                                                            className="bg-[#25D366] hover:bg-[#20ba56] text-white font-bold h-10 px-5 gap-2 rounded-xl"
                                                            onClick={async () => {
                                                                const magicUrl = await handleGenerateReport(item)
                                                                if (magicUrl) {
                                                                    window.open(getWhatsAppUrl(item.parentPhone, item.studentName, item.courseTitle, magicUrl), "_blank")
                                                                }
                                                            }}
                                                        >
                                                            <MessageSquare className="h-4 w-4" />
                                                            إرسال التقرير الآن
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* CREATION MANUAL SHEET PANEL */}
            <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
                <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto font-arabic flex flex-col">
                    <SheetHeader className="text-right border-b pb-6">
                        <SheetTitle className="text-2xl font-black">إنشاء تقرير دراسي</SheetTitle>
                        <SheetDescription className="text-sm font-bold text-muted-foreground">
                            سيتم أخذ لقطة إحصائية كاملة للحضور والتقدم ودرجات الطالب المسجلة لمشاركتها مع ولي الأمر.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedStudent && (
                        <div className="flex-1 py-6 space-y-6">
                            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden border">
                                    {selectedStudent.avatar ? (
                                        <img src={selectedStudent.avatar} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        selectedStudent.name.charAt(0)
                                    )}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-black text-sm truncate">{selectedStudent.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-bold truncate">ولي الأمر: {selectedStudent.parentPhone || "غير متوفر"}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="note" className="font-bold">ملاحظة يدوية اختيارية لولي الأمر</Label>
                                <Textarea
                                    id="note"
                                    placeholder="اكتب توجيهاتك أو ملاحظاتك للمعلم على مستوى الطالب وتفاعل في الحصص..."
                                    className="min-h-[120px] font-medium border-zinc-300 focus:border-primary rounded-xl"
                                    value={manualNote}
                                    onChange={(e) => setManualNote(e.target.value)}
                                />
                            </div>

                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3 text-xs">
                                <h5 className="font-bold text-primary flex items-center gap-1.5">
                                    <AlertCircle className="h-4 w-4" />
                                    التقرير يحتوي على:
                                </h5>
                                <ul className="space-y-1.5 font-medium text-zinc-600 list-disc list-inside">
                                    <li>نسبة حضور المحاضرات ({selectedStudent.completedLessons} / {selectedStudent.totalLessons}).</li>
                                    <li>نسبة إنجاز كورس المواد ({selectedStudent.progress}%).</li>
                                    <li>درجات جميع الامتحانات ({selectedStudent.submissions.length} اختبار) والمتوسط الكلي.</li>
                                    <li>مقارنة مع أعلى درجة في الفصل.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <SheetFooter className="border-t pt-6">
                        <Button className="w-full h-12 font-bold gap-2 rounded-xl text-base shadow-lg shadow-primary/20" onClick={() => handleGenerateReport()} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart3 className="h-5 w-5" />}
                            اعتماد وتوليد التقرير 📈
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* GENERATION RESULT MODAL */}
            <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
                <DialogContent className="sm:max-w-md font-arabic text-right">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-2xl font-black text-primary">تم توليد التقرير بنجاح! 🎉</DialogTitle>
                        <DialogDescription className="text-sm font-bold text-muted-foreground">
                            تم إصدار التقرير وأخذ لقطة للبيانات. الرابط صالح لمدة 30 يوماً.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedStudent && (
                        <div className="py-6 space-y-6">
                            <div className="space-y-2">
                                <Label className="font-bold">الرابط السري لولي الأمر (بدون تسجيل دخول)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        className="h-11 font-bold text-zinc-600 bg-zinc-50 border-zinc-200 select-all"
                                        value={generatedLink}
                                        readOnly
                                    />
                                    <Button 
                                        variant="outline" 
                                        className="h-11 px-3 border-zinc-200"
                                        onClick={() => {
                                            navigator.clipboard.writeText(generatedLink)
                                            toast.success("تم نسخ الرابط بنجاح!")
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                <Button size="lg" className="h-12 bg-[#25D366] hover:bg-[#20ba56] text-white font-bold gap-2 rounded-xl" asChild>
                                    <a href={getWhatsAppUrl(selectedStudent.parentPhone, selectedStudent.name, courses.find(c => c.id === selectedCourseId)?.title, generatedLink)} target="_blank" rel="noreferrer">
                                        <MessageSquare className="h-5 w-5" />
                                        إرسال عبر واتساب
                                    </a>
                                </Button>
                                <Button size="lg" variant="outline" className="h-12 border-zinc-200 font-bold gap-2 rounded-xl" asChild>
                                    <a href={getEmailUrl(selectedStudent.email, selectedStudent.name, courses.find(c => c.id === selectedCourseId)?.title, generatedLink)}>
                                        <Mail className="h-5 w-5" />
                                        إرسال عبر إيميل
                                    </a>
                                </Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="sm:justify-start">
                        <Button variant="secondary" className="font-bold w-full h-11 rounded-xl" onClick={() => setIsResultOpen(false)}>
                            إغلاق النافذة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
