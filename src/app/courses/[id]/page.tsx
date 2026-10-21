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
    Loader2,
    Wallet,
    CreditCard,
    ArrowRight,
    Zap,
    Sparkles
} from "lucide-react"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction, increment } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logActivity } from "@/lib/activity-logger"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

export default function CourseDetailsPage() {
    const { id } = useParams()
    const router = useRouter()
    const [course, setCourse] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isEnrolling, setIsEnrolling] = useState(false)
    const [isEnrolled, setIsEnrolled] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)

    // Checkout modal states
    const [showCheckoutDialog, setShowCheckoutDialog] = useState(false)
    const [isFawaterakLoading, setIsFawaterakLoading] = useState(false)

    // Coupon states
    const [couponCode, setCouponCode] = useState("")
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                // Fetch profile with real-time wallet balance
                try {
                    const res = await fetch("/api/profile/me")
                    if (res.ok) {
                        const data = await res.json()
                        setProfile(data)
                    } else {
                        const pDoc = await getDoc(doc(db, "profiles", currentUser.uid))
                        if (pDoc.exists()) setProfile(pDoc.data())
                    }
                } catch {
                    const pDoc = await getDoc(doc(db, "profiles", currentUser.uid))
                    if (pDoc.exists()) setProfile(pDoc.data())
                }

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
                    courseData.instructor_verified = courseData.instructor_verified || false
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

    // Direct Fawaterak Online Payment for Course
    const handleFawaterakCoursePay = async () => {
        if (!user) {
            toast.error("يرجى تسجيل الدخول أولاً للالتحاق بالكورس")
            router.push(`/login?redirect=/courses/${id}`)
            return
        }

        setIsFawaterakLoading(true)
        try {
            const idToken = await user.getIdToken()
            const res = await fetch("/api/payments/fawaterak/initiate-course", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId: course.id,
                    couponCode: appliedCoupon?.code || null,
                    idToken,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "فشل الاتصال ببوابة فواتيرك")
            }

            if (data.paymentUrl) {
                toast.loading("جاري تحويلك إلى صفحة الدفع الآمنة في فواتيرك...")
                window.location.href = data.paymentUrl
            } else {
                throw new Error("لم يتم استلام رابط الدفع من فواتيرك")
            }
        } catch (error: any) {
            console.error("Fawaterak course pay error:", error)
            toast.error(error.message || "حدث خطأ أثناء بدء عملية الدفع الإلكتروني")
            setIsFawaterakLoading(false)
        }
    }

    const handleEnroll = async () => {
        if (!user) {
            toast.error("يرجى تسجيل الدخول أولاً للالتحاق بالكورس")
            router.push(`/login?redirect=/courses/${id}`)
            return
        }

        setIsEnrolling(true)
        try {
            const res = await fetch("/api/courses/enroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId: course.id,
                    couponCode: appliedCoupon?.code || null,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "فشل الاشتراك في الكورس");
            }

            const finalPrice = data.paidAmount ?? (Number(course.price) || 0);
            toast.success("تم الالتحاق بالكورس بنجاح!");
            setIsEnrolled(true)

            // Log activity
            logActivity({
                action: "course_enrolled",
                category: finalPrice > 0 ? "financial" : "course",
                title: finalPrice > 0 ? "شراء واشتراك في كورس" : "اشتراك في كورس مجاني",
                description: finalPrice > 0
                    ? `قام الطالب بالاشتراك في كورس "${course.title}" وخصم ${finalPrice} ج.م من محفظته وإيداع ${finalPrice * 0.95} ج.م للمحاضر (بعد 5% عمولة)`
                    : `قام الطالب بالاشتراك مجاناً في كورس "${course.title}"`,
                status: "success",
                user_id: user.uid,
                user_name: user.displayName || "طالب",
                user_email: user.email || "",
                user_role: "student",
                target_user_id: course.instructor_id,
                target_user_name: course.instructor_name,
                amount: finalPrice > 0 ? finalPrice : 0,
                metadata: {
                    course_id: course.id,
                    course_title: course.title,
                    price: Number(course.price) || 0,
                    final_paid: finalPrice,
                    instructor_share: finalPrice * 0.95,
                    platform_commission: finalPrice * 0.05,
                    coupon_code: appliedCoupon?.code || null,
                }
            }).catch(() => {})
        } catch (error: any) {
            console.error("Enrollment error details:", error)

            // Log failure
            logActivity({
                action: "course_enroll_failed",
                category: "course",
                title: "فشل شراء كورس",
                description: `فشلت محاولة الاشتراك في كورس "${course?.title || id}": ${error.message || "خطأ غير معروف"}`,
                status: "failed",
                user_id: user?.uid,
                user_name: user?.displayName || "طالب",
                user_email: user?.email || "",
                user_role: "student",
                amount: course?.price || 0,
                error_message: error.message,
                metadata: { course_id: course?.id, course_title: course?.title }
            }).catch(() => {})

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

                                {!isEnrolled && profile?.role !== 'instructor' && profile?.role !== 'admin' && (
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
                                ) : profile?.role === 'instructor' && course.instructor_id === user?.uid ? (
                                    <Button className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700" size="lg" asChild>
                                        <Link href={`/learn/${course.id}`}>معاينة الكورس (أنت المدرس)</Link>
                                    </Button>
                                ) : isEnrolled ? (
                                    <Button className="w-full h-12 text-lg font-bold" size="lg" asChild>
                                        <Link href={`/learn/${course.id}`}>دخول للكورس</Link>
                                    </Button>
                                ) : profile?.role === 'instructor' ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                        <p className="text-sm font-bold text-amber-800">محفظة المدرس مخصصة للسحب فقط</p>
                                        <p className="text-xs text-amber-600 mt-1">لا يمكن للمدرسين شراء الكورسات من المنصة</p>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full h-12 text-lg font-bold shadow-lg hover:shadow-primary/25 transition-all gap-2"
                                        size="lg"
                                        onClick={() => {
                                            if (!user) {
                                                toast.error("يرجى تسجيل الدخول أولاً للالتحاق بالكورس")
                                                router.push(`/login?redirect=/courses/${id}`)
                                                return
                                            }
                                            const cPrice = Number(course?.price || 0)
                                            const dPct = appliedCoupon ? Number(appliedCoupon.discount_percent || 0) : 0
                                            const fPrice = Math.max(0, cPrice - (cPrice * dPct) / 100)
                                            if (fPrice === 0) {
                                                handleEnroll()
                                            } else {
                                                setShowCheckoutDialog(true)
                                            }
                                        }}
                                        disabled={isEnrolling}
                                    >
                                        {isEnrolling ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                جاري المعالجة...
                                            </>
                                        ) : Number(course.price || 0) === 0 ? (
                                            "الالتحاق بالكورس مجاناً"
                                        ) : (
                                            <>
                                                <Sparkles className="h-5 w-5" />
                                                الاشتراك وشراء الكورس الآن
                                            </>
                                        )}
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

            {/* Checkout Dialog Modal */}
            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
                <DialogContent className="sm:max-w-md font-arabic text-right p-6 rounded-2xl" dir="rtl">
                    <DialogHeader className="text-right space-y-2">
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            تأكيد الاشتراك في الكورس
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            اختر طريقة الدفع المناسبة لك لإتمام الالتحاق بكورس <strong className="text-foreground">"{course?.title}"</strong>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Price Breakdown */}
                    {(() => {
                        const cPrice = Number(course?.price || 0)
                        const dPct = appliedCoupon ? Number(appliedCoupon.discount_percent || 0) : 0
                        const fPrice = Math.max(0, cPrice - (cPrice * dPct) / 100)
                        const walletBal = Number(profile?.wallet_balance ?? 0)

                        return (
                            <div className="space-y-4 pt-1">
                                <div className="p-4 bg-muted/40 rounded-xl space-y-2 border">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>السعر الأصلي:</span>
                                        <span className={appliedCoupon ? "line-through text-muted-foreground" : "font-bold text-foreground"}>
                                            {cPrice} ج.م
                                        </span>
                                    </div>
                                    {appliedCoupon && (
                                        <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                                            <span>خصم الكوبون ({appliedCoupon.discount_percent}%):</span>
                                            <span>- {((cPrice * Number(appliedCoupon.discount_percent)) / 100).toFixed(0)} ج.م</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between pt-2 border-t font-black text-sm text-foreground">
                                        <span>المبلغ المطلوب سداده:</span>
                                        <span className="text-lg text-primary font-black">{fPrice} ج.م</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* Option 1: Pay from Wallet */}
                                    <div className={`p-4 rounded-xl border-2 transition-all space-y-3 ${
                                        walletBal >= fPrice
                                            ? "border-primary/40 bg-primary/5 hover:border-primary"
                                            : "border-muted bg-muted/20 opacity-90"
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                                <Wallet className="h-4 w-4 text-primary" />
                                                <span>الدفع من رصيد المحفظة الداخلي</span>
                                            </div>
                                            <Badge variant="outline" className="text-xs font-bold">
                                                رصيدك: {walletBal} ج.م
                                            </Badge>
                                        </div>

                                        {walletBal >= fPrice ? (
                                            <Button
                                                type="button"
                                                onClick={async () => {
                                                    await handleEnroll()
                                                    setShowCheckoutDialog(false)
                                                }}
                                                disabled={isEnrolling}
                                                className="w-full h-11 rounded-xl font-bold gap-2 shadow-md"
                                            >
                                                {isEnrolling ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        جاري الخصم والتفعيل...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        تأكيد والخصم من المحفظة ({fPrice} ج.م)
                                                    </>
                                                )}
                                            </Button>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                    رصيد محفظتك غير كافٍ لإتمام الشراء من المحفظة.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="w-full h-9 rounded-lg font-bold text-xs gap-1.5"
                                                >
                                                    <Link href="/dashboard/wallet" target="_blank">
                                                        <span>شحن المحفظة يدوياً (فودافون كاش / إنستاباي)</span>
                                                        <ArrowRight className="h-3 w-3 mr-auto" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="relative flex py-1 items-center">
                                        <div className="flex-grow border-t border-muted"></div>
                                        <span className="flex-shrink mx-3 text-muted-foreground text-[10px] font-bold">أو ادفع مباشرة إلكترونياً</span>
                                        <div className="flex-grow border-t border-muted"></div>
                                    </div>

                                    {/* Option 2: Fawaterak Instant Payment */}
                                    <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                                    <Zap className="h-4 w-4 text-emerald-600 fill-emerald-600" />
                                                    <span>دفع إلكتروني فوري (فواتيرك)</span>
                                                </div>
                                                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                                    تفعيل لحظي ⚡
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                فيزا، ماستركارد، كروت ميزة، محافظ الهاتف، فوري باي، أو إنستاباي.
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={handleFawaterakCoursePay}
                                            disabled={isFawaterakLoading || fPrice < 10}
                                            className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-600/20"
                                        >
                                            {isFawaterakLoading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    جاري الاتصال ببوابة فواتيرك...
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard className="h-4 w-4" />
                                                    <span>الانتقال لبوابة فواتيرك وسداد ({fPrice} ج.م)</span>
                                                    <ArrowRight className="h-4 w-4 mr-auto" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    )
}
