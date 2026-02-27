"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    CheckCircle,
    XCircle,
    Eye,
    AlertCircle,
    Loader2
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function AdminCoursesPage() {
    const [courses, setCourses] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchPendingCourses()
    }, [])

    async function fetchPendingCourses() {
        try {
            const q = query(collection(db, "courses"), where("status", "==", "pending"))
            const querySnapshot = await getDocs(q)
            const sortedCourses = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            setCourses(sortedCourses)
        } catch (error) {
            console.error("Error fetching pending courses:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (courseId: string) => {
        try {
            await updateDoc(doc(db, "courses", courseId), {
                status: "approved",
                updated_at: new Date().toISOString()
            })
            toast.success("تم اعتماد الكورس بنجاح!")
            setCourses(courses.filter(c => c.id !== courseId))
        } catch (error) {
            console.error("Approval error:", error)
            toast.error("حدث خطأ أثناء اعتماد الكورس")
        }
    }

    const handleReject = async (courseId: string) => {
        try {
            // we could also add a rejection reason field
            await updateDoc(doc(db, "courses", courseId), {
                status: "rejected",
                updated_at: new Date().toISOString()
            })
            toast.info("تم رفض الكورس")
            setCourses(courses.filter(c => c.id !== courseId))
        } catch (error) {
            console.error("Rejection error:", error)
            toast.error("حدث خطأ أثناء رفض الكورس")
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-arabic">مراجعة الكورسات 📝</h1>
                <p className="text-muted-foreground mt-2 font-arabic">قم بمراجعة محتوى الكورسات الجديدة للموافقة على نشرها.</p>
            </div>

            {courses.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                        <CheckCircle className="h-12 w-12 text-green-500/50" />
                        <p className="text-muted-foreground font-arabic">لا توجد كورسات بانتظار المراجعة حالياً. عمل رائع!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {courses.map((course) => (
                        <Card key={course.id} className="overflow-hidden">
                            <div className="flex flex-col md:flex-row h-full">
                                <div className="w-full md:w-64 aspect-video md:aspect-auto relative shrink-0">
                                    <img
                                        src={course.thumbnail_url || course.thumbnail || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"}
                                        alt={course.title}
                                        className="object-cover w-full h-full"
                                    />
                                    <Badge className="absolute top-2 right-2 bg-orange-500 hover:bg-orange-600">بانتظار المراجعة</Badge>
                                </div>
                                <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-xl font-bold font-arabic line-clamp-1">{course.title}</h3>
                                            <span className="font-bold text-primary">{course.price} ج.م</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground font-arabic line-clamp-2">{course.description}</p>
                                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
                                            <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {course.category}</span>
                                            <span className="flex items-center gap-1">👤 {course.instructor_name}</span>
                                            <span className="flex items-center gap-1">📅 {new Date(course.created_at).toLocaleDateString('ar-EG')}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            asChild
                                        >
                                            <Link href={`/courses/${course.id}`} target="_blank">
                                                <Eye className="h-4 w-4" />
                                                معاينة الكورس
                                            </Link>
                                        </Button>
                                        <div className="mr-auto flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white gap-2"
                                                onClick={() => handleReject(course.id)}
                                            >
                                                <XCircle className="h-4 w-4" />
                                                رفض
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 gap-2 font-bold"
                                                onClick={() => handleApprove(course.id)}
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                                اعتماد ونشر
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
