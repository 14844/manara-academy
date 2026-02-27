"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    PlusCircle,
    Search,
    BookOpen,
    Users,
    TrendingUp,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Settings,
    Loader2
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import Link from "next/link"

export default function InstructorCoursesPage() {
    const [courses, setCourses] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                fetchCourses(user.uid)
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchCourses(instructorId: string) {
        setIsLoading(true)
        try {
            const q = query(
                collection(db, "courses"),
                where("instructor_id", "==", instructorId)
            )
            const querySnapshot = await getDocs(q)
            const coursesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setCourses(coursesData.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ))
        } catch (error) {
            console.error("Error fetching courses:", error)
            toast.error("فشل في تحميل الكورسات")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteCourse = async (courseId: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا الكورس نهائياً؟")) return

        try {
            await deleteDoc(doc(db, "courses", courseId))
            setCourses(courses.filter(c => c.id !== courseId))
            toast.success("تم حذف الكورس بنجاح")
        } catch (error) {
            console.error("Delete error:", error)
            toast.error("حدث خطأ أثناء الحذف")
        }
    }

    const filteredCourses = courses.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black">كورساتي التعليمية</h1>
                    <p className="text-muted-foreground mt-1 italic">إدارة كافة الكورسات التي قمت بإنشائها على المنصة</p>
                </div>
                <Button className="gap-2 shadow-lg hover:shadow-primary/20 transition-all rounded-xl h-12 px-6" asChild>
                    <Link href="/instructor/courses/new">
                        <PlusCircle className="h-5 w-5" />
                        إنشاء كورس جديد
                    </Link>
                </Button>
            </div>

            <div className="flex items-center gap-4 bg-background p-2 rounded-2xl border-2 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ابحث عن كورس معين بالاسم أو التصنيف..."
                        className="pr-10 border-none bg-transparent focus-visible:ring-0 text-md h-12"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filteredCourses.length === 0 ? (
                <Card className="border-2 border-dashed bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                        <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                        <div className="text-center">
                            <h3 className="text-xl font-bold">لا توجد نتائج بحث</h3>
                            <p className="text-muted-foreground">ابدأ بإنشاء أول كورس لك الآن!</p>
                        </div>
                        <Button variant="outline" className="mt-4 rounded-xl" asChild>
                            <Link href="/instructor/courses/new">إضافة أول كورس</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course) => (
                        <Card key={course.id} className="group overflow-hidden border-2 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-xl">
                            <div className="aspect-video relative overflow-hidden">
                                <img
                                    src={course.thumbnail_url || course.thumbnail || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    alt={course.title}
                                />
                                <div className="absolute top-3 right-3 flex gap-2">
                                    <Badge
                                        variant={course.status === 'approved' ? 'default' : course.status === 'rejected' ? 'destructive' : 'secondary'}
                                        className="shadow-lg backdrop-blur-md bg-opacity-90"
                                    >
                                        {course.status === 'approved' ? 'منشور' : course.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                                    </Badge>
                                </div>
                            </div>
                            <CardHeader className="p-5 pb-2">
                                <div className="flex justify-between items-start gap-4">
                                    <CardTitle className="text-lg font-black line-clamp-1 leading-normal group-hover:text-primary transition-colors">{course.title}</CardTitle>
                                    <DropdownMenu dir="rtl">
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 hover:bg-muted rounded-full">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-2">
                                            <DropdownMenuItem asChild className="cursor-pointer gap-2 p-3 rounded-lg">
                                                <Link href={`/instructor/courses/${course.id}/manage`}>
                                                    <Edit className="h-4 w-4 text-blue-500" />
                                                    تعديل الكورس
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer gap-2 p-3 rounded-lg">
                                                <Link href={`/courses/${course.id}`} target="_blank">
                                                    <Eye className="h-4 w-4 text-green-500" />
                                                    معاينة الصفحة
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer gap-2 p-3 rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
                                                onClick={() => handleDeleteCourse(course.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                حذف الكورس
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <CardDescription className="line-clamp-2 min-h-[2.5rem] mt-1 text-xs">
                                    {course.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 pt-0 space-y-4">
                                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-t pt-4">
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        <span>32 طالب</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        <span>{course.price} ج.م</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Badge variant="outline" className="text-[9px] py-0">{course.category}</Badge>
                                    </div>
                                </div>
                                <Button className="w-full gap-2 rounded-xl h-10 font-bold" variant="secondary" asChild>
                                    <Link href={`/instructor/courses/${course.id}/manage`}>
                                        <Settings className="h-4 w-4" />
                                        إدارة المحتوى والدروس
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
