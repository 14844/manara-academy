"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Users,
    BookOpen,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    Clock
} from "lucide-react"

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalCourses: 0,
        pendingCourses: 0,
        approvedCourses: 0
    })
    const [recentCourses, setRecentCourses] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchAdminStats() {
            try {
                // Fetch stats concurrently
                const usersSnap = await getDocs(collection(db, "profiles"))
                const coursesSnap = await getDocs(collection(db, "courses"))

                const courses = coursesSnap.docs.map(doc => doc.data())
                const pending = courses.filter(c => c.status === 'pending').length
                const approved = courses.filter(c => c.status === 'approved').length

                setStats({
                    totalUsers: usersSnap.size,
                    totalCourses: coursesSnap.size,
                    pendingCourses: pending,
                    approvedCourses: approved
                })

                // Get 5 most recent courses
                const recentQ = query(collection(db, "courses"), orderBy("created_at", "desc"), limit(5))
                const recentSnap = await getDocs(recentQ)
                setRecentCourses(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))

            } catch (error) {
                console.error("Error fetching admin stats:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchAdminStats()
    }, [])

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">مرحباً بك في لوحة الإدارة 🛡️</h1>
                <p className="text-muted-foreground mt-2">نظرة عامة على أداء المنصة والعمليات الجارية.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="إجمالي المستخدمين"
                    value={stats.totalUsers.toString()}
                    icon={<Users className="h-4 w-4" />}
                    color="text-blue-500"
                />
                <StatCard
                    title="إجمالي الكورسات"
                    value={stats.totalCourses.toString()}
                    icon={<BookOpen className="h-4 w-4" />}
                    color="text-purple-500"
                />
                <StatCard
                    title="بانتظار المراجعة"
                    value={stats.pendingCourses.toString()}
                    icon={<AlertCircle className="h-4 w-4" />}
                    color="text-orange-500"
                />
                <StatCard
                    title="الكورسات المنشورة"
                    value={stats.approvedCourses.toString()}
                    icon={<CheckCircle className="h-4 w-4" />}
                    color="text-green-500"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>أحدث الكورسات المضافة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentCourses.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-8">لا توجد كورسات مضافة حديثاً.</p>
                            ) : (
                                recentCourses.map((course) => (
                                    <div key={course.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-16 rounded bg-muted overflow-hidden shrink-0">
                                                <img src={course.thumbnail_url || course.thumbnail || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"} alt={course.title} className="object-cover w-full h-full" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm line-clamp-1">{course.title}</p>
                                                <p className="text-xs text-muted-foreground">{course.instructor_name} • {new Date(course.created_at).toLocaleDateString('ar-EG')}</p>
                                            </div>
                                        </div>
                                        <Badge variant={course.status === 'approved' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                            {course.status === 'approved' ? 'منشور' : 'معلق'}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>تنبيهات سريعة</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stats.pendingCourses > 0 && (
                            <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-600">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p className="text-sm font-medium">لديك {stats.pendingCourses} كورسات بانتظار المراجعة والاعتماد.</p>
                            </div>
                        )}
                        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-600">
                            <Clock className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">تذكر مراجعة طلبات سحب الأرباح نهاية كل شهر.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className={color}>{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

import { Badge } from "@/components/ui/badge"
