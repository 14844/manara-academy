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
    CheckCircle,
    PlayCircle,
    Lock,
    ChevronDown,
    ChevronUp,
    Shield,
    FileText,
    ClipboardList,
    HelpCircle,
    AlertCircle,
    Ticket,
    Activity,
    Loader2
} from "lucide-react"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction, increment } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CourseDetailsPage() {
    const { id } = useParams()
    const router = useRouter()
    const [course, setCourse] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isEnrolling, setIsEnrolling] = useState(false)
    const [isEnrolled, setIsEnrolled] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)

    // Coupon states
    const [couponCode, setCouponCode] = useState("")
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null)


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
                    const courseData = { id: docSnap.id, ...docSnap.data() } as any
                
                // Fetch instructor verification from profiles
                const instructorRef = doc(db, "profiles", courseData.instructor_id)
                const instructorSnap = await getDoc(instructorRef)
                if (instructorSnap.exists()) {
                    courseData.instructor_verified = instructorSnap.data().is_verified
                }
                
                setCourse(courseData)
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
            const coursePrice = Number(course.price) || 0
            const enrollmentId = `${user.uid}_${course.id}`

            // Use transaction for BOTH paid and free paths to ensure consistent analytics and students_count
            await runTransaction(db, async (transaction) => {
                const studentProfileRef = doc(db, "profiles", user.uid)
                const instructorProfileRef = doc(db, "profiles", course.instructor_id)
                const enrollmentRef = doc(db, "enrollments", enrollmentId)
                const courseRef = doc(db, "courses", course.id)
                const transactionLogRef = doc(collection(db, "transactions"))

                // 1. Fetch Student Profile
                const studentSnap = await transaction.get(studentProfileRef)
                if (!studentSnap.exists()) throw new Error("لم يتم العثور على ملف تعريف الطالب")

                // 2. Fetch Instructor Profile (optional check but good for safety)
                const instructorSnap = await transaction.get(instructorProfileRef)
                // If it doesn't exist, we might want to log it but let enrollment proceed if rules allow
                // Actually, if it doesn't exist, updating it will fail, so we should be aware.

                // 3. Calculate Financials
                let finalPrice = coursePrice
                if (appliedCoupon) {
                    const discount = (coursePrice * appliedCoupon.discount_percent) / 100
                    finalPrice = Math.max(0, coursePrice - discount)
                }

                // 4. Handle Payment (if price > 0)
                if (finalPrice > 0) {
                    const currentBalance = studentSnap.data().wallet_balance || 0
                    if (currentBalance < finalPrice) {
                        throw new Error(`رصيدك غير كافٍ. تحتاج إلى ${finalPrice} بينما رصيدك ${currentBalance} ج.م.`)
                    }

                    // Deduct from Student
                    transaction.update(studentProfileRef, {
                        wallet_balance: currentBalance - finalPrice,
                        updated_at: new Date().toISOString()
                    })

                    // Add to Instructor (80% of actual paid amount)
                    const instructorEarnings = finalPrice * 0.8
                    const platformCommission = finalPrice * 0.2
                    
                    transaction.update(instructorProfileRef, {
                        wallet_balance: increment(instructorEarnings),
                        updated_at: new Date().toISOString()
                    })

                    // Create Financial Audit Log
                    transaction.set(transactionLogRef, {
                        type: "enrollment_payout",
                        amount: finalPrice,
                        instructor_id: course.instructor_id,
                        instructor_share: instructorEarnings,
                        platform_commission: platformCommission,
                        student_id: user.uid,
                        student_name: studentSnap.data().full_name || user.displayName,
                        course_id: course.id,
                        course_title: course.title,
                        coupon_used: appliedCoupon?.code || null,
                        created_at: new Date().toISOString()
                    })
                }

                // 5. Create/Update Enrollment (Consistent fields for both paths)
                transaction.set(enrollmentRef, {
                    id: enrollmentId,
                    student_id: user.uid,
                    student_name: studentSnap.data().full_name || user.displayName,
                    student_unique_id: studentSnap.data().student_id || "N/A",
                    course_id: course.id,
                    course_title: course.title,
                    instructor_id: course.instructor_id,
                    instructor_name: course.instructor_name,
                    enrolled_at: new Date().toISOString(),
                    progress: 0,
                    status: "active",
                    paid_amount: finalPrice,
                    original_price: coursePrice,
                    coupon_used: appliedCoupon?.code || null
                })

                // 6. Update Coupon Usage if applicable
                if (appliedCoupon) {
                    const couponRef = doc(db, "coupons", appliedCoupon.id)
                    transaction.update(couponRef, {
                        usage_count: increment(1)
                    })
                }

                // 7. Increment students_count
                transaction.update(courseRef, {
                    students_count: increment(1)
                })
            })

            toast.success("تم الالتحاق بالكورس بنجاح!")
            setIsEnrolled(true)
        } catch (error: any) {
            console.error("Enrollment error details:", error)
            // Specific messages for common errors
            if (error.code === 'permission-denied') {
                toast.error("خطأ في الصلاحيات المالكية. يرجى التواصل مع الدعم الفني.")
            } else {
                toast.error(error.message || "حدث خطأ أثناء الالتحاق بالكورس")
            }
        } finally {
            setIsEnrolling(false)
        }
    }

    const handleApplyCoupon = async () => {
        if (!couponCode) return
        if (appliedCoupon && appliedCoupon.code === couponCode.toUpperCase()) {
            toast.info("هذا الكوبون مفعل بالفعل")
            return
        }

        setIsApplyingCoupon(true)
        try {
            const q = query(collection(db, "coupons"), where("code", "==", couponCode.toUpperCase()))
            const snap = await getDocs(q)

            if (snap.empty) {
                toast.error("عذراً، هذا الكود غير صحيح")
                setAppliedCoupon(null)
                setIsApplyingCoupon(false)
                return
            }

            const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any

            // Validation logic
            if (!couponData.active) {
                toast.error("هذا الكوبون معطل حالياً")
                setIsApplyingCoupon(false)
                return
            }

            if (couponData.usage_count >= couponData.max_uses) {
                toast.error("عذراً، وصل هذا الكوبون للحد الأقصى للاستخدام")
                setIsApplyingCoupon(false)
                return
            }

            if (couponData.course_id !== "all" && couponData.course_id !== id) {
                toast.error("هذا الكود غير مخصص لهذا الكورس")
                setIsApplyingCoupon(false)
                return
            }

            setAppliedCoupon(couponData)
            toast.success(`تم تطبيق الخصم بنجاح! خصم بقيمة ${couponData.discount_percent}%`)
        } catch (error) {
            console.error("Coupon error:", error)
            toast.error("حدث خطأ أثناء فحص الكوبون")
        } finally {
            setIsApplyingCoupon(false)
        }
    }

    const basePrice = Number(course?.price) || 0
    const finalPrice = appliedCoupon 
        ? basePrice - (basePrice * appliedCoupon.discount_percent / 100) 
        : basePrice

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
                            <div className="flex flex-wrap gap-2 items-center">
                                <Badge className="text-sm px-4 py-1.5 bg-primary/10 text-primary border-primary/20 backdrop-blur-sm">{course.category}</Badge>
                            </div>
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight text-right">
                                {course.title}
                            </h1>
                            <p className="text-lg text-muted-foreground lg:max-w-[600px] text-right">
                                {course.description}
                            </p>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground justify-end">
                                <div className="flex items-center font-bold text-foreground">
                                    <User className="ml-2 h-4 w-4 text-primary" />
                                    {course.instructor_name}
                                    {course.instructor_verified && (
                                        <CheckCircle2 className="mr-1.5 h-4 w-4 text-blue-500 fill-blue-50" />
                                    )}
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
                    <div className="lg:col-span-2 space-y-8" dir="rtl">
                        <div>
                            <h2 className="text-2xl font-bold mb-4 text-right">ماذا ستتعلم؟</h2>
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
                            <h2 className="text-2xl font-bold mb-4 text-right">محتوى الكورس</h2>
                            <div className="space-y-4">
                                {course.modules?.map((module: any, idx: number) => (
                                    <Card key={module.id} className="border-muted/60">
                                        <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/10 text-primary h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">
                                                        {idx + 1}
                                                    </div>
                                                    <CardTitle className="text-base text-right">{module.title}</CardTitle>
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
                                                            <span className="text-sm font-medium text-right">{lesson.title}</span>
                                                            <span className="text-[10px] text-muted-foreground text-right">
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
                    <div className="space-y-6" dir="rtl">
                        <Card className="sticky top-24 shadow-xl border-primary/20">
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">سعر الكورس الحالي</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-4xl font-black ${appliedCoupon ? 'text-muted-foreground/50 line-through text-2xl' : 'text-primary'}`}>
                                            {basePrice}
                                        </span>
                                        {appliedCoupon && (
                                            <span className="text-4xl font-black text-green-600">
                                                {finalPrice}
                                            </span>
                                        )}
                                        <span className="text-xl font-bold text-primary">ج.م</span>
                                    </div>
                                </div>

                                {!isEnrolled && (
                                    <div className="space-y-2 border-y py-4 my-2">
                                        <Label className="text-xs font-bold flex items-center gap-2">
                                            <Ticket className="h-3 w-3 text-primary" />
                                            هل لديك كوبون خصم؟
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                placeholder="أدخل الكود هنا..."
                                                className="h-10 text-xs font-bold uppercase tracking-widest text-right"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value)}
                                                disabled={isApplyingCoupon}
                                            />
                                            <Button 
                                                type="button" 
                                                variant={appliedCoupon && couponCode.toUpperCase() === appliedCoupon.code ? "outline" : "default"}
                                                className="h-10 px-4 text-xs font-bold shrink-0"
                                                onClick={handleApplyCoupon}
                                                disabled={isApplyingCoupon || !couponCode}
                                            >
                                                {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                                                 (appliedCoupon && couponCode.toUpperCase() === appliedCoupon.code) ? <CheckCircle className="h-4 w-4 text-green-500" /> : "تطبيق"}
                                            </Button>
                                        </div>
                                        {appliedCoupon && (
                                            <p className="text-[10px] text-green-600 font-bold flex items-center gap-1 animate-pulse">
                                                <Activity className="h-3 w-3" />
                                                تم تطبيق خصم {appliedCoupon.discount_percent}% بنجاح!
                                            </p>
                                        )}
                                    </div>
                                )}

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

                                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg space-y-2">
                                    <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        تنبيه حول الاسترجاع:
                                    </p>
                                    <p className="text-[10px] text-red-800/70 leading-relaxed font-bold">
                                        لا يمكن استرجاع قيمة الكورس أو سحب الرصيد من المحفظة بعد بدء مشاهدة المحتوى التعليمي.
                                    </p>
                                </div>

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
