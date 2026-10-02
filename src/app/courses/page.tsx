"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, BookOpen, Clock, User, Filter, Loader2, X, ArrowUpDown, CheckCircle2 } from "lucide-react"
import Link from "next/link"

import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
    "other": "كورس عام"
}

export default function CoursesPage() {
    const [selectedCategory, setSelectedCategory] = useState("الكل")
    const [selectedGrade, setSelectedGrade] = useState("الكل")
    const [sortOrder, setSortOrder] = useState("latest")
    const [searchQuery, setSearchQuery] = useState("")
    const [courses, setCourses] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchCourses() {
            try {
                let q = collection(db, "courses")
                const querySnapshot = await getDocs(q)
                const fetchedCourses = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))

                const enrollmentsSnap = await getDocs(collection(db, "enrollments"))
                const enrollments = enrollmentsSnap.docs.map(doc => doc.data())

                const profilesSnap = await getDocs(collection(db, "profiles"))
                const profilesMap: Record<string, any> = {}
                profilesSnap.forEach(doc => {
                    profilesMap[doc.id] = doc.data()
                })

                const updatedCourses = fetchedCourses.map((course: any) => ({
                    ...course,
                    students_count: enrollments.filter((e: any) => e.course_id === course.id).length,
                    instructor_verified: profilesMap[course.instructor_id]?.is_verified || false
                }))

                setCourses(updatedCourses)
            } catch (error) {
                console.error("Error fetching courses:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchCourses()
    }, [])

    const filteredAndSortedCourses = courses
        .filter(course => {
            const matchesCategory = selectedCategory === "الكل" || course.category === selectedCategory
            const matchesGrade = selectedGrade === "الكل" || course.grade_level === selectedGrade
            const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCategory && matchesGrade && matchesSearch
        })
        .sort((a, b) => {
            if (sortOrder === "price-asc") return a.price - b.price
            if (sortOrder === "price-desc") return b.price - a.price
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })

    const resetFilters = () => {
        setSelectedCategory("الكل")
        setSelectedGrade("الكل")
        setSortOrder("latest")
        setSearchQuery("")
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container py-10">
                <div className="flex flex-col space-y-8">
                    {/* Header & Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-4xl font-black tracking-tight">تصفح الكورسات</h1>
                            <p className="text-muted-foreground font-medium">اكتشف أفضل الكورسات لتعزيز مهاراتك اليوم</p>
                        </div>
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="ابحث عن كورس، مدرس أو مادة..."
                                className="pr-10 h-12 rounded-xl border-muted-foreground/20 focus:border-primary transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-muted">
                        <div className="flex flex-wrap gap-2 flex-1">
                            {CATEGORIES.map((category) => (
                                <Button
                                    key={category}
                                    variant={selectedCategory === category ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setSelectedCategory(category)}
                                    className={`rounded-xl px-4 font-bold transition-all ${selectedCategory === category ? "shadow-md shadow-primary/20" : "hover:bg-background"}`}
                                >
                                    {category === "الكل" ? "الكل" : (CATEGORY_MAP[category] || category)}
                                </Button>
                            ))}
                        </div>

                        <div className="h-8 w-px bg-muted mx-2 hidden md:block" />

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 rounded-xl font-bold border-primary/20 hover:bg-primary/5 hover:text-primary">
                                    <Filter className="h-4 w-4" />
                                    تصفية متقدمة
                                    {(selectedGrade !== "الكل" || sortOrder !== "latest") && (
                                        <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                            !
                                        </Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                                <SheetHeader>
                                    <SheetTitle className="text-right font-black text-2xl">تصفية متقدمة</SheetTitle>
                                    <SheetDescription className="text-right font-medium">قم بتخصيص نتائج البحث بدقة</SheetDescription>
                                </SheetHeader>
                                
                                <div className="space-y-8 py-8" dir="rtl">
                                    {/* Grade Filter */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-black flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-primary" />
                                            الصف الدراسي
                                        </label>
                                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                            <SelectTrigger className="w-full rounded-xl">
                                                <SelectValue placeholder="اختر الصف الدراسي" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="الكل">كل المراحل</SelectItem>
                                                {Object.entries(GRADE_MAP).map(([val, label]) => (
                                                    <SelectItem key={val} value={val}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Sorting */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-black flex items-center gap-2">
                                            <ArrowUpDown className="h-4 w-4 text-primary" />
                                            ترتيب حسب
                                        </label>
                                        <Select value={sortOrder} onValueChange={setSortOrder}>
                                            <SelectTrigger className="w-full rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="latest">الأحدث أولاً</SelectItem>
                                                <SelectItem value="price-asc">السعر: من الأقل للأعلى</SelectItem>
                                                <SelectItem value="price-desc">السعر: من الأعلى للأقل</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button 
                                        variant="outline" 
                                        className="w-full rounded-xl gap-2 font-bold text-destructive hover:bg-destructive/5 border-destructive/20"
                                        onClick={resetFilters}
                                    >
                                        <X className="h-4 w-4" />
                                        إعادة ضبط الفلاتر
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {isLoading ? (
                        <div className="col-span-full text-center py-32 flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground font-black italic tracking-wide">جاري البحث عن أفضل الكورسات لك...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredAndSortedCourses.map((course) => (
                                <CourseCard key={course.id} course={course} />
                            ))}
                        </div>
                    )}
                </div>

                {!isLoading && filteredAndSortedCourses.length === 0 && (
                    <div className="text-center py-32 border-2 border-dashed rounded-3xl bg-muted/20">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xl font-black mb-2">لم نجد أي نتائج!</h3>
                        <p className="text-muted-foreground font-medium mb-6">جرب تغيير كلمات البحث أو إزالة بعض الفلاتر المتقدمة</p>
                        <Button variant="outline" onClick={resetFilters} className="rounded-xl font-bold">إعادة الضبط</Button>
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
                <div className="absolute top-2 right-2 flex flex-col gap-2 items-end z-10">
                    <Badge className="bg-primary/95 backdrop-blur-sm shadow-md">{CATEGORY_MAP[course.category] || course.category}</Badge>
                    {course.gradeLevel && (
                        <Badge variant="secondary" className="bg-white/95 text-black border-none text-[10px] shadow-sm">
                            {GRADE_MAP[course.gradeLevel] || course.gradeLevel}
                        </Badge>
                    )}
                </div>
            </div>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg line-clamp-2 min-h-[3.5rem] leading-snug">{course.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center text-sm text-foreground font-bold">
                    <User className="ml-2 h-4 w-4 text-primary" />
                    {course.instructor_name}
                    {course.instructor_verified && (
                        <CheckCircle2 className="mr-1.5 h-4 w-4 text-blue-500 fill-blue-50" />
                    )}
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
            <CardFooter className="p-4 border-t flex flex-col gap-3">
                <div className="w-full flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="font-black text-xl text-primary">{course.price || 0} ج.م</span>
                    </div>
                    <Button size="sm" asChild className="rounded-xl font-bold shadow-md shadow-primary/20">
                        <Link href={`/courses/${course.id}`}>تفاصيل الكورس</Link>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
