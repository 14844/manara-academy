"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Users,
    Mail,
    Phone,
    GraduationCap,
    Search,
    Loader2,
    TrendingUp,
    ExternalLink,
    CheckCircle2,
    FileText,
    ShieldAlert
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function InstructorStudentsPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [students, setStudents] = useState<any[]>([])
    const [filteredStudents, setFilteredStudents] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [instructorCourseIds, setInstructorCourseIds] = useState<string[]>([])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser)
                fetchStudentsData(currentUser.uid)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        const filtered = students.filter(student =>
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.phone.includes(searchTerm)
        )
        setFilteredStudents(filtered)
    }, [searchTerm, students])

    async function fetchStudentsData(instructorId: string) {
        setIsLoading(true)
        try {
            // 1. Get all courses by this instructor
            const coursesQ = query(collection(db, "courses"), where("instructor_id", "==", instructorId))
            const coursesSnap = await getDocs(coursesQ)
            const myCourseIds = coursesSnap.docs.map(doc => doc.id)
            setInstructorCourseIds(myCourseIds)
            const coursesMap = new Map(coursesSnap.docs.map(doc => [doc.id, doc.data()]))

            if (myCourseIds.length === 0) {
                setStudents([])
                setIsLoading(false)
                return
            }

            // 2. Get all enrollments for this instructor (single-field query, no 'in' limit)
            const enrollmentsQ = query(
                collection(db, "enrollments"),
                where("instructor_id", "==", instructorId)
            )
            const enrollmentsSnap = await getDocs(enrollmentsQ)
            const allEnrollments = enrollmentsSnap.docs.map(doc => doc.data())

            // 3. Group by student
            const studentGroups: any = {}

            for (const enr of allEnrollments) {
                if (!studentGroups[enr.student_id]) {
                    studentGroups[enr.student_id] = {
                        id: enr.student_id,
                        name: enr.student_name || "طالب",
                        enrollments: []
                    }
                }
                studentGroups[enr.student_id].enrollments.push({
                    ...enr,
                    courseTitle: coursesMap.get(enr.course_id)?.title || enr.course_title || "كورس غير معروف"
                })
            }

            // 4. Fetch profiles via API route (reads from profiles_private securely)
            let instructorApiStudents: Record<string, any> = {}
            try {
                const apiRes = await fetch("/api/instructor/students")
                if (apiRes.ok) {
                    const apiData = await apiRes.json()
                    instructorApiStudents = apiData.students || {}
                } else {
                    const errData = await apiRes.json().catch(() => ({}))
                    console.warn("Students API returned error:", errData.error || apiRes.status)
                }
            } catch (e) {
                console.warn("Students API unreachable:", e)
            }

            const studentIds = Object.keys(studentGroups)
            const studentData = await Promise.all(studentIds.map(async (sid) => {
                const apiStudent = instructorApiStudents[sid]
                let pData = apiStudent || {}
                if (!apiStudent) {
                    try {
                        const profileDoc = await getDoc(doc(db, "profiles", sid))
                        pData = profileDoc.exists() ? profileDoc.data() : {}
                    } catch {
                        pData = {}
                    }
                }

                // Fetch submissions
                let submissions: any[] = []
                try {
                    const subsQ = query(
                        collection(db, "submissions"),
                        where("instructor_id", "==", instructorId),
                        where("student_id", "==", sid)
                    )
                    const subsSnap = await getDocs(subsQ)
                    submissions = subsSnap.docs.map(doc => doc.data())
                } catch (e) {
                    console.warn(`Failed to load submissions for student ${sid}:`, e)
                }

                return {
                    ...studentGroups[sid],
                    email: pData.email || studentGroups[sid].enrollments[0]?.student_email || "غير متوفر",
                    phone: pData.phone || studentGroups[sid].enrollments[0]?.student_phone || "غير متوفر",
                    parentPhone: pData.parent_phone || pData.parentPhone || "غير متوفر",
                    avatar: pData.avatar_url || pData.avatar || null,
                    status: pData.status || "active",
                    submissions: submissions.filter(s => myCourseIds.includes(s.course_id))
                }
            }))

            setStudents(studentData)
        } catch (error: any) {
            console.error("Error fetching instructor students:", error)
            toast.error(`فشل تحميل بيانات الطلاب: ${error.message || "خطأ في الاتصال بالخادم"}`)
        } finally {
            setIsLoading(false)
        }
    }

    const handleKick = async (studentId: string) => {
        if (!window.confirm("هل أنت متأكد من استبعاد الطالب من جميع كورساتك؟")) return

        try {
            const res = await fetch("/api/instructor/students/kick", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.error || "فشل استبعاد الطالب")
            }

            toast.success("تم استبعاد الطالب من كورساتك بنجاح")
            setIsDetailOpen(false)
            if (user?.uid) fetchStudentsData(user.uid) // Refresh list
        } catch (error: any) {
            console.error("Kick error:", error)
            toast.error(error.message || "حدث خطأ أثناء استبعاد الطالب")
        }
    }

    const openStudentDetail = (student: any) => {
        router.push(`/instructor/students/${student.id}`)
    }

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Users className="h-8 w-8 text-primary" />
                        إدارة الطلاب
                    </h1>
                    <p className="text-muted-foreground mt-1">تتبع تقدم جميع الطلاب في كورساتك المختلفة.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ابحث بالاسم، الإيميل أو الهاتف..."
                        className="pr-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filteredStudents.length === 0 ? (
                <Card className="border-2 border-dashed bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-muted-foreground">لا يوجد طلاب</h3>
                        <p className="text-sm text-muted-foreground">لم يشترك أي طالب في كورساتك حتى الآن أو لم يتم العثور على نتائج بحث.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStudents.map((student) => (
                        <Card
                            key={student.id}
                            className="group hover:shadow-xl transition-all cursor-pointer border-zinc-200"
                            onClick={() => openStudentDetail(student)}
                        >
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg overflow-hidden border">
                                        {student.avatar ? (
                                            <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                                        ) : (
                                            student.name.charAt(0)
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <CardTitle className="text-lg truncate">{student.name}</CardTitle>
                                        <CardDescription className="flex items-center gap-1.5 text-xs">
                                            <Mail className="h-3.5 w-3.5" />
                                            <span className="truncate">{student.email}</span>
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{student.phone}</span>
                                </div>
                                <div className="pt-4 border-t space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1 font-bold">
                                            <GraduationCap className="h-3.5 w-3.5" />
                                            عدد الكورسات:
                                        </span>
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                            {student.enrollments.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span>متوسط التقدم</span>
                                            <span>{Math.round(student.enrollments.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / student.enrollments.length)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${Math.round(student.enrollments.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / student.enrollments.length)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" className="w-full text-xs gap-2 group-hover:bg-primary group-hover:text-white transition-colors">
                                    عرض الملف الكامل
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
