"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, BookOpen, Clock, User, Filter, Loader2 } from "lucide-react"
import Link from "next/link"

import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useEffect } from "react"

const CATEGORIES = ["الكل", "arabic", "math", "english", "science", "physics", "chemistry", "other"]
const CATEGORY_MAP: Record<string, string> = {
    "arabic": "لغة عربية",
    "math": "رياضيات",
    "english": "لغة إنجليزية",
    "science": "علوم",
    "physics": "فيزياء",
    "chemistry": "كيمياء",
    "other": "أخرى / عام"
}

const GRADE_MAP: Record<string, string> = {
    "primary_1": "أول ابتدائي",
    "primary_2": "ثاني ابتدائي",
    "primary_3": "ثالث ابتدائي",
    "primary_4": "رابع ابتدائي",
    "primary_5": "خامس ابتدائي",
    "primary_6": "سادس ابتدائي",
    "prep_1": "أول إعدادي",
    "prep_2": "ثاني إعدادي",
    "prep_3": "ثالث إعدادي",
    "sec_1": "أول ثانوي",
    "sec_2": "ثاني ثانوي",
    "sec_3": "ثالث ثانوي",
    "other": "كورس عام / غير مرتبط بصف"
}

export default function CoursesPage() {
    const [selectedCategory, setSelectedCategory] = useState("الكل")
    const [searchQuery, setSearchQuery] = useState("")
    const [courses, setCourses] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchCourses() {
            try {
                let q = collection(db, "courses")
                // Only show approved courses (we'll implement status later, but status: "approved" is the goal)
                // For now, let's just get all courses to see if it works
                const querySnapshot = await getDocs(q)
                const fetchedCourses = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                setCourses(fetchedCourses)
            } catch (error) {
                console.error("Error fetching courses:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchCourses()
    }, [])

    const filteredCourses = courses.filter(course => {
        const matchesCategory = selectedCategory === "الكل" || course.category === selectedCategory
        const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch
    })

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container py-10">
                <div className="flex flex-col space-y-8">
                    {/* Header & Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold">تصفح الكورسات</h1>
                            <p className="text-muted-foreground mt-2">اكتشف أفضل الكورسات لتعزيز مهاراتك اليوم</p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="ابحث عن كورس..."
                                className="pr-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((category) => (
                            <Button
                                key={category}
                                variant={selectedCategory === category ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedCategory(category)}
                                className="rounded-full"
                            >
                                {category}
                            </Button>
                        ))}
                        <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 mr-auto">
                            <Filter className="h-4 w-4" />
                            تصفية متقدمة
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="col-span-full text-center py-20 flex flex-col items-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground italic">جاري تحميل الكورسات...</p>
                        </div>
                    ) : (
                        <>
                            {filteredCourses.map((course) => (
                                <CourseCard key={course.id} course={course} />
                            ))}
                        </>
                    )}
                </div>

                {!isLoading && filteredCourses.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-xl text-muted-foreground italic">لم نجد أي كورسات تطابق بحثك</p>
                    </div>
                )}
            </main>
        </div>
    )
}

function CourseCard({ course }: { course: any }) {
    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow border-muted/60">
            <div className="aspect-video relative overflow-hidden">
                <img
                    src={course.thumbnail_url || "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"}
                    alt={course.title}
                    className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    <Badge className="bg-primary/90">{CATEGORY_MAP[course.category] || course.category}</Badge>
                    {course.gradeLevel && (
                        <Badge variant="secondary" className="bg-white/90 text-black border-none text-[10px]">
                            {GRADE_MAP[course.gradeLevel] || course.gradeLevel}
                        </Badge>
                    )}
                </div>
            </div>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg line-clamp-2 min-h-[3.5rem] leading-snug">{course.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                    <User className="ml-2 h-4 w-4" />
                    {course.instructor_name}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center">
                        <Clock className="ml-1 h-3.5 w-3.5" />
                        {course.duration || "جاري التحديد"}
                    </div>
                    <div className="flex items-center">
                        <BookOpen className="ml-1 h-3.5 w-3.5" />
                        {course.students_count || 0} طالب
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-4 border-t flex items-center justify-between">
                <span className="font-bold text-lg text-primary">{course.price} ج.م</span>
                <Button size="sm" asChild>
                    <Link href={`/courses/${course.id}`}>تفاصيل الكورس</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
