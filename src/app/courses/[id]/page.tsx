"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
    BookOpen,
    Clock,
    User,
    CheckCircle2,
    PlayCircle,
    Lock,
    ChevronDown,
    ChevronUp,
    Shield,
    FileText,
    ClipboardList,
    HelpCircle
} from "lucide-react"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import Link from "next/link"

export default function CourseDetailsPage() {
    const { id } = useParams()
    const router = useRouter()
    const [course, setCourse] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isEnrolling, setIsEnrolling] = useState(false)
    const [isEnrolled, setIsEnrolled] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                // Fetch profile
                const pDoc = await getDoc(doc(db, "profiles", currentUser.uid))
                if (pDoc.exists()) setProfile(pDoc.data())

                if (id) {
                    const enrollmentRef = doc(db, "enrollments", `${currentUser.uid}_${id}`)
                    const enrollmentSnap = await getDoc(enrollmentRef)
                    setIsEnrolled(enrollmentSnap.exists())
                }
            }
        })
        return () => unsubscribe()
    }, [id])

    useEffect(() => {
        async function fetchCourse() {
            if (!id) return
            try {
                const docRef = doc(db, "courses", id as string)
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                    setCourse({ id: docSnap.id, ...docSnap.data() })
                } else {
                    toast.error("الكورس غير موجود")
                    router.push("/courses")
                }
            } catch (error) {
                console.error("Error fetching course:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchCourse()
    }, [id, router])

    const handleEnroll = async () => {
        if (!user) {
            toast.error("يرجى تسجيل الدخول أولاً للالتحاق بالكورس")
            router.push(`/login?redirect=/courses/${id}`)
            return
        }

        setIsEnrolling(true)
        try {
            const enrollmentId = `${user.uid}_${course.id}`
            const coursePrice = Number(course.price) || 0

            if (coursePrice > 0) {
                const currentBalance = Number(profile?.wallet_balance) || 0

                if (currentBalance < coursePrice) {
                    toast.error("عذراً، رصيدك غير كافٍ للاتحاق بهذا الكورس", {
                        description: "يرجى شحن المحفظة أولاً متبوعاً بمراجعة الإدارة.",
                        action: {
                            label: "شحن المحفظة",
                            onClick: () => router.push("/dashboard/wallet")
                        }
                    })
                    setIsEnrolling(false)
                    return
                }

                // Use transaction to ensure balance is deducted and enrollment created atomically
                await runTransaction(db, async (transaction) => {
                    const profileRef = doc(db, "profiles", user.uid)
                    const enrollmentRef = doc(db, "enrollments", enrollmentId)

                    const pSnap = await transaction.get(profileRef)
                    if (!pSnap.exists()) throw new Error("Profile not found")

                    const newBalance = (pSnap.data().wallet_balance || 0) - coursePrice
                    if (newBalance < 0) throw new Error("Insufficient balance")

                    transaction.update(profileRef, {
                        wallet_balance: newBalance,
                        updated_at: new Date().toISOString()
                    })

                    transaction.set(enrollmentRef, {
                        id: enrollmentId,
                        student_id: user.uid,
                        student_name: profile?.full_name || user.displayName,
                        student_unique_id: profile?.student_id || "N/A",
                        course_id: course.id,
                        course_title: course.title,
                        instructor_id: course.instructor_id,
                        instructor_name: course.instructor_name,
                        enrolled_at: new Date().toISOString(),
                        progress: 0,
                        status: "active",
                        paid_amount: coursePrice
                    })

                    // Increment students_count in course document
                    transaction.update(doc(db, "courses", course.id), {
                        students_count: (course.students_count || 0) + 1
                    })
                })
            } else {
                // Free course enrollment
                await setDoc(doc(db, "enrollments", enrollmentId), {
                    id: enrollmentId,
                    student_id: user.uid,
                    student_name: profile?.full_name || user.displayName,
                    student_unique_id: profile?.student_id || "N/A",
                    course_id: course.id,
                    course_title: course.title,
                    instructor_id: course.instructor_id,
                    instructor_name: course.instructor_name,
                    enrolled_at: new Date().toISOString(),
                    progress: 0,
                    status: "active",
                    paid_amount: 0
                })

                // Increment students_count
                const courseRef = doc(db, "courses", course.id)
                const cSnap = await getDoc(courseRef)
                if (cSnap.exists()) {
                    await updateDoc(courseRef, {
                        students_count: (cSnap.data().students_count || 0) + 1
                    })
                }
            }

            toast.success("تم الالتحاق بالكورس بنجاح!")
            setIsEnrolled(true)
        } catch (error: any) {
            console.error("Enrollment error:", error)
            toast.error("حدث خطأ أثناء الالتحاق بالكورس: " + (error.message || ""))
        } finally {
            setIsEnrolling(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col">
                <Navbar />
                <div className="flex flex-1 items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-muted/30 py-12 md:py-20">
                    <div className="container grid gap-8 md:grid-cols-2 items-center">
                        <div className="space-y-6">
                            <Badge className="text-sm px-3 py-1">{course.category}</Badge>
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                                {course.title}
                            </h1>
                            <p className="text-lg text-muted-foreground lg:max-w-[600px]">
                                {course.description}
                            </p>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                    <User className="ml-2 h-4 w-4" />
                                    {course.instructor_name}
                                </div>
                                <div className="flex items-center">
                                    <Clock className="ml-2 h-4 w-4" />
                                    {course.duration || "جاري التحديد"}
                                </div>
                                <div className="flex items-center">
                                    <Shield className="ml-2 h-4 w-4" />
                                    شهادة معتمدة
                                </div>
                            </div>
                        </div>
                        <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl border">
                            <img
                                src={course.thumbnail_url || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"}
                                alt={course.title}
                                className="object-cover w-full h-full"
                            />
                        </div>
                    </div>
                </section>

                <div className="container py-12 grid gap-8 lg:grid-cols-3">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold mb-4">ماذا ستتعلم؟</h2>
                            <div className="grid gap-3 md:grid-cols-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                        <span className="text-sm text-muted-foreground">معرفة أساسيات ومبادئ {course.category} بشكل احترافي.</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold mb-4">محتوى الكورس</h2>
                            <div className="space-y-4">
                                {course.modules?.map((module: any, idx: number) => (
                                    <Card key={module.id} className="border-muted/60">
                                        <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/10 text-primary h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">
                                                        {idx + 1}
                                                    </div>
                                                    <CardTitle className="text-base">{module.title}</CardTitle>
                                                </div>
                                                <span className="text-xs text-muted-foreground">{module.lessons?.length} دروس</span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0 border-t">
                                            {module.lessons?.map((lesson: any) => (
                                                <div key={lesson.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors border-b last:border-0 group">
                                                    <div className="flex items-center gap-3">
                                                        {(lesson.type === 'video' || !lesson.type) && <PlayCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
                                                        {lesson.type === 'file' && <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
                                                        {lesson.type === 'assignment' && <ClipboardList className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
                                                        {lesson.type === 'exam' && <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{lesson.title}</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {lesson.type === 'video' || !lesson.type ? "درس فيديو" :
                                                                    lesson.type === 'file' ? "ملف / ملخص" :
                                                                        lesson.type === 'assignment' ? "واجب منزلي" : "اختبار شامل"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {!isEnrolled && (
                                                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                                    )}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar / CTA */}
                    <div className="space-y-6">
                        <Card className="sticky top-24 shadow-xl border-primary/20">
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">سعر الكورس</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-primary">{course.price}</span>
                                        <span className="text-xl font-bold text-primary">ج.م</span>
                                    </div>
                                </div>

                                {profile?.role === 'admin' ? (
                                    <Button className="w-full h-12 text-lg font-bold bg-amber-600 hover:bg-amber-700" size="lg" asChild>
                                        <Link href={`/learn/${course.id}`}>دخول كمسؤول (معاينة)</Link>
                                    </Button>
                                ) : isEnrolled ? (
                                    <Button className="w-full h-12 text-lg font-bold" size="lg" asChild>
                                        <Link href={`/learn/${course.id}`}>دخول للكورس</Link>
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full h-12 text-lg font-bold"
                                        size="lg"
                                        onClick={handleEnroll}
                                        disabled={isEnrolling}
                                    >
                                        {isEnrolling ? "جاري المعالجة..." : "الالتحاق بالكورس الآن"}
                                    </Button>
                                )}

                                <ul className="space-y-3 text-sm">
                                    <li className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                        <span>{course.modules?.length || 0} وحدات تعليمية</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <PlayCircle className="h-4 w-4 text-primary" />
                                        <span>وصول كامل مدى الحياة</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" />
                                        <span>شهادة إتمام عند النجاح</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
