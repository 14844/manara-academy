"use client"

import { Navbar } from "@/components/navbar"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Trophy, Clock, PlayCircle, Settings, UserCircle, Wallet, Search } from "lucide-react"
import Link from "next/link"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Loader2 } from "lucide-react"

export default function StudentDashboard() {
    const [user, setUser] = useState<any>(null)
    const [enrolledCourses, setEnrolledCourses] = useState<any[]>([])
    const [recommendedCourses, setRecommendedCourses] = useState<any[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isRecommending, setIsRecommending] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                try {
                    // 0. Fetch profile
                    const pDoc = await getDoc(doc(db, "profiles", currentUser.uid))
                    const userData = pDoc.exists() ? pDoc.data() : null
                    if (userData) setProfile(userData)

                    // 1. Fetch enrollments
                    const enrollmentsQ = query(collection(db, "enrollments"), where("student_id", "==", currentUser.uid))
                    const enrollmentsSnap = await getDocs(enrollmentsQ)
                    const enrolledIds = enrollmentsSnap.docs.map(d => d.data().course_id)

                    const coursePromises = enrollmentsSnap.docs.map(async (enrollmentDoc) => {
                        const enrollmentData = enrollmentDoc.data()
                        const courseRef = doc(db, "courses", enrollmentData.course_id)
                        const courseSnap = await getDoc(courseRef)
                        if (courseSnap.exists()) {
                            return {
                                ...courseSnap.data(),
                                progress: enrollmentData.progress || 0,
                                last_accessed: enrollmentData.last_accessed
                            }
                        }
                        return null
                    })

                    const fetchedCourses = (await Promise.all(coursePromises)).filter(c => c !== null)
                    setEnrolledCourses(fetchedCourses)

                    // 2. Fetch Recommendations based on Grade Level
                    if (userData?.grade_level) {
                        setIsRecommending(true)
                        const coursesRef = collection(db, "courses")
                        // Fetch courses for their grade OR general courses
                        const q1 = query(coursesRef, where("grade_level", "==", userData.grade_level))
                        const q2 = query(coursesRef, where("grade_level", "==", "other"))
                        
                        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
                        
                        const allRecs = [...snap1.docs, ...snap2.docs]
                            .map(d => ({ id: d.id, ...d.data() as any }))
                            // Exclude already enrolled
                            .filter(c => !enrolledIds.includes(c.id))
                            // Handle duplicates from both queries
                            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
                            .slice(0, 4) // Limit to 4

                        setRecommendedCourses(allRecs)
                        setIsRecommending(false)
                    }
                } catch (error) {
                    console.error("Error fetching dashboard data:", error)
                } finally {
                    setIsLoading(false)
                }
            } else {
                setIsLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    const GRADE_NAMES: Record<string, string> = {
        primary_1: "الأول الابتدائي",
        primary_2: "الثاني الابتدائي",
        primary_3: "الثالث الابتدائي",
        primary_4: "الرابع الابتدائي",
        primary_5: "الخامس الابتدائي",
        primary_6: "السادس الابتدائي",
        prep_1: "الأول الإعدادي",
        prep_2: "الثاني الإعدادي",
        prep_3: "الثالث الإعدادي",
        sec_1: "الأول الثانوي",
        sec_2: "الثاني الثانوي",
        sec_3: "الثالث الثانوي",
        other: "كورسات عامة"
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container py-10">
                <div className="flex flex-col space-y-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-extrabold tracking-tight">لوحة تحكم الطالب</h1>
                            <p className="text-muted-foreground">مرحباً بك مجدداً يا بطل، استكمل رحلة تعلمك!</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-2" asChild>
                                <Link href="/student/profile">
                                    <Settings className="h-4 w-4" />
                                    تعديل الملف
                                </Link>
                            </Button>
                            <Button size="sm" className="gap-2" asChild>
                                <Link href="/courses">
                                    <Search className="h-4 w-4" />
                                    تصفح الكل
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xs font-bold text-muted-foreground">عدد الكورسات</CardTitle>
                                <BookOpen className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black">{enrolledCourses.length}</div>
                            </CardContent>
                        </Card>
                        <Card className="relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xs font-bold text-muted-foreground">الشهادات المكتسبة</CardTitle>
                                <Trophy className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black">٠</div>
                            </CardContent>
                        </Card>
                        <Card className="relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xs font-bold text-muted-foreground">ساعات التعلم</CardTitle>
                                <Clock className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black tracking-tight">
                                    {(enrolledCourses.reduce((acc, course) => acc + (parseFloat(course.duration) || 0), 0)).toLocaleString('ar-EG')}
                                    <span className="text-sm font-bold text-muted-foreground mr-1">ساعة</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="relative overflow-hidden group bg-primary/5 border-primary/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xs font-bold text-primary">رصيد المحفظة</CardTitle>
                                <Wallet className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <div className="text-3xl font-black text-primary">{profile?.wallet_balance || 0} <span className="text-xs">ج.م</span></div>
                                <Button size="sm" variant="outline" className="h-8 border-primary/30 hover:bg-primary/10" asChild>
                                    <Link href="/dashboard/wallet">شحن</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_350px] gap-8">
                        {/* Main Content: Current Courses */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black flex items-center gap-2">
                                    <span className="h-8 w-1.5 bg-primary rounded-full" />
                                    كورساتي الحالية
                                </h2>
                                {enrolledCourses.length > 0 && <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">{enrolledCourses.length} كورس</span>}
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-muted-foreground font-bold italic">جاري تحميل كورساتك...</p>
                                </div>
                            ) : enrolledCourses.length === 0 ? (
                                <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/20 flex flex-col items-center gap-4">
                                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                                        <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground font-bold italic">لا يوجد لديك كورسات ملتحق بها حالياً.</p>
                                        <p className="text-xs text-muted-foreground/60">ابدأ رحلتك الآن وقم بالاشتراك في أول كورس لك!</p>
                                    </div>
                                    <Button className="mt-2 rounded-xl" asChild>
                                        <Link href="/courses">تصفح الكورسات المتاحة</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-6">
                                    {enrolledCourses.map((course) => (
                                        <Card key={course.id} className="overflow-hidden group hover:shadow-md transition-all border-muted/60">
                                            <div className="flex flex-col md:flex-row h-full">
                                                <div className="w-full md:w-56 aspect-video md:aspect-auto relative shrink-0 overflow-hidden">
                                                    <img 
                                                        src={course.thumbnail_url || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"} 
                                                        alt={course.title} 
                                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                                                    />
                                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                                </div>
                                                <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                                                    <div className="space-y-1">
                                                        <h3 className="font-extrabold text-xl line-clamp-1">{course.title}</h3>
                                                        <p className="text-xs font-bold text-muted-foreground flex items-center">
                                                            <UserCircle className="ml-1 h-3 w-3" />
                                                            م/ {course.instructor_name}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                                            <span>نسبة التقدم</span>
                                                            <span className="text-primary">{course.progress}%</span>
                                                        </div>
                                                        <Progress value={course.progress} className="h-2 bg-muted shadow-inner" />
                                                    </div>
                                                    <Button className="w-full font-bold h-11 rounded-xl shadow-lg shadow-primary/20" asChild>
                                                        <Link href={`/learn/${course.id}`}>
                                                            <PlayCircle className="ml-2 h-4 w-4" />
                                                            متابعة التعلم
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sidebar: Recommendations */}
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <span className="h-6 w-1.5 bg-primary rounded-full" />
                                    الكورسات المرشحة لك ✨
                                </h2>
                                {profile?.grade_level && (
                                    <p className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold w-fit">
                                        بناءً على صفك: {GRADE_NAMES[profile.grade_level]}
                                    </p>
                                )}

                                {isRecommending ? (
                                    <div className="space-y-4">
                                        {[1, 2].map(i => (
                                            <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
                                        ))}
                                    </div>
                                ) : recommendedCourses.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-10 bg-muted/20 rounded-2xl border border-dashed text-balance px-4">
                                        لا توجد مقترحات إضافية حالياً لصفك الدراسي، يمكنك استكشاف باقي الأقسام.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {recommendedCourses.map((course) => (
                                            <Card key={course.id} className="overflow-hidden border-muted group cursor-pointer hover:border-primary/50 transition-colors shadow-sm hover:shadow-md">
                                                <div className="aspect-[16/9] relative">
                                                    <img 
                                                        src={course.thumbnail_url || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"} 
                                                        alt={course.title} 
                                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                                                        <h4 className="text-white font-bold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">{course.title}</h4>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-card flex items-center justify-between">
                                                    <span className="text-xs font-black text-primary">{course.price} ج.م</span>
                                                    <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold hover:bg-primary/10" asChild>
                                                        <Link href={`/courses/${course.id}`}>تفاصيل</Link>
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Help Banner */}
                            <Card className="bg-zinc-900 text-white border-none overflow-hidden relative shadow-2xl">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12" />
                                <CardContent className="p-6 space-y-4">
                                    <h3 className="font-bold text-lg">تحتاج للمساعدة؟</h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-bold">فريق الدعم الفني متواجد دائماً لمساعدتك في أي استفسار عبر الواتساب.</p>
                                    <Button variant="outline" className="w-full bg-white/5 border-white/10 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] text-white transition-all font-bold" asChild>
                                        <a href="https://wa.me/201017333215" target="_blank" rel="noreferrer">تواصل معنا واتساب</a>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
