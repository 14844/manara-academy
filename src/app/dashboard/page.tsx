"use client"

import { Navbar } from "@/components/navbar"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Trophy, Clock, PlayCircle, Settings, UserCircle, Wallet } from "lucide-react"
import Link from "next/link"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Loader2 } from "lucide-react"

export default function StudentDashboard() {
    const [user, setUser] = useState<any>(null)
    const [enrolledCourses, setEnrolledCourses] = useState<any[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                try {
                    // 0. Fetch profile
                    const pDoc = await getDoc(doc(db, "profiles", currentUser.uid))
                    if (pDoc.exists()) setProfile(pDoc.data())

                    // 1. Fetch enrollments
                    const enrollmentsQ = query(collection(db, "enrollments"), where("student_id", "==", currentUser.uid))
                    const enrollmentsSnap = await getDocs(enrollmentsQ)

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
                } catch (error) {
                    console.error("Error fetching enrollments:", error)
                } finally {
                    setIsLoading(false)
                }
            } else {
                setIsLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])
    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container py-10">
                <div className="flex flex-col space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold">لوحة تحكم الطالب</h1>
                            <p className="text-muted-foreground mt-2">مرحباً بك مجدداً يا بطل، استكمل رحلة تعلمك!</p>
                        </div>
                        <Button variant="outline" className="gap-2" asChild>
                            <Link href="/student/profile">
                                <Settings className="h-4 w-4" />
                                تعديل الملف الشخصي
                            </Link>
                        </Button>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">عدد الكورسات</CardTitle>
                                <BookOpen className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{enrolledCourses.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">الشهادات المكتسبة</CardTitle>
                                <Trophy className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">٠</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">ساعات التعلم</CardTitle>
                                <Clock className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {(enrolledCourses.reduce((acc, course) => acc + (parseFloat(course.duration) || 0), 0)).toLocaleString('ar-EG')} ساعة
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="md:col-span-1 bg-primary/5 border-primary/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">رصيد المحفظة</CardTitle>
                                <Wallet className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <div className="text-2xl font-bold">{profile?.wallet_balance || 0} ج.م</div>
                                <Button size="sm" variant="ghost" className="text-xs h-7 px-2" asChild>
                                    <Link href="/dashboard/wallet">شحن</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold">كورساتي الحالية</h2>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-muted-foreground">جاري تحميل كورساتك...</p>
                            </div>
                        ) : enrolledCourses.length === 0 ? (
                            <div className="text-center py-20 border rounded-lg bg-muted/50 border-dashed">
                                <p className="text-muted-foreground">لا يوجد لديك كورسات ملتحق بها حالياً.</p>
                                <Button className="mt-4" asChild>
                                    <Link href="/courses">تصفح الكورسات المتاحة</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2">
                                {enrolledCourses.map((course) => (
                                    <Card key={course.id} className="overflow-hidden flex flex-col md:flex-row h-full">
                                        <div className="w-full md:w-48 aspect-video md:aspect-auto relative shrink-0">
                                            <img src={course.thumbnail_url || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"} alt={course.title} className="object-cover w-full h-full" />
                                        </div>
                                        <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                                            <div className="space-y-2">
                                                <h3 className="font-bold text-lg line-clamp-1">{course.title}</h3>
                                                <p className="text-sm text-muted-foreground">المدرب: {course.instructor_name}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span>التقدم: {course.progress}%</span>
                                                </div>
                                                <Progress value={course.progress} className="h-2" />
                                            </div>
                                            <Button className="w-full mt-2" asChild>
                                                <Link href={`/learn/${course.id}`}>
                                                    <PlayCircle className="ml-2 h-4 w-4" />
                                                    متابعة التعلم
                                                </Link>
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
