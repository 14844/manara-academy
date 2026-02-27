"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    BookOpen,
    Trash2,
    ExternalLink,
    Search,
    Loader2,
    GraduationCap,
    Clock,
    DollarSign
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export default function AdminAllCoursesPage() {
    const [courses, setCourses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        fetchAllCourses()
    }, [])

    async function fetchAllCourses() {
        setLoading(true)
        try {
            const q = query(collection(db, "courses"), orderBy("created_at", "desc"))
            const querySnapshot = await getDocs(q)
            const coursesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setCourses(coursesData)
        } catch (error) {
            console.error("Error fetching courses:", error)
            toast.error("حدث خطأ أثناء تحميل الكورسات")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا الكورس نهائياً؟")) return
        try {
            await deleteDoc(doc(db, "courses", id))
            setCourses(courses.filter(c => c.id !== id))
            toast.success("تم حذف الكورس بنجاح")
        } catch (error) {
            console.error("Delete error:", error)
            toast.error("فشل حذف الكورس")
        }
    }

    const filteredCourses = courses.filter(c =>
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.instructor_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">جميع الكورسات</h1>
                    <p className="text-muted-foreground italic">عرض وإدارة كافة المحتوى التعليمي على المنصة</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="بحث بالعنوان أو المدرس..."
                        className="pr-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-6">
                {filteredCourses.length > 0 ? (
                    filteredCourses.map((course) => (
                        <Card key={course.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-48 h-32 md:h-auto bg-muted relative shrink-0">
                                    <img
                                        src={course.thumbnail_url || course.thumbnail || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"}
                                        alt={course.title}
                                        className="object-cover w-full h-full"
                                    />
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <Badge className={course.status === 'approved' ? "bg-green-600" : "bg-orange-500"}>
                                            {course.status === 'approved' ? 'منشور' : 'بانتظار المراجعة'}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-6 flex-1 flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant="outline">{course.category}</Badge>
                                            <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {course.grade_level}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(course.created_at).toLocaleDateString('ar-EG')}</span>
                                        </div>
                                        <h3 className="text-xl font-bold">{course.title}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{course.description}</p>
                                        <div className="flex items-center gap-2 pt-2">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">
                                                {course.instructor_name?.[0]}
                                            </div>
                                            <span className="text-sm font-medium">المدرس: {course.instructor_name}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 pt-4 md:pt-0">
                                        <div className="text-center md:text-left">
                                            <div className="flex items-center gap-1 text-2xl font-black text-primary">
                                                {course.price}
                                                <span className="text-xs font-normal">ج.م</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/courses/${course.id}`}>
                                                    <ExternalLink className="h-4 w-4 ml-2" />
                                                    عرض
                                                </Link>
                                            </Button>
                                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-white" onClick={() => handleDelete(course.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <p className="text-muted-foreground">لم يتم العثور على أي كورسات تطابق بحثك</p>
                    </div>
                )}
            </div>
        </div>
    )
}
