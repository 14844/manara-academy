"use client"

import { useState, useEffect, useLayoutEffect } from "react"
import { Navbar } from "@/components/navbar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, BookOpen, Clock, User, Filter, X, ArrowUpDown, CheckCircle2, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { getCourseThumbnailUrl } from "@/lib/utils"
import { isPublishedCourse } from "@/components/landing/public-stats"
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

/** Only the fields the listing needs — keeps state and the local cache small. */
interface CourseListItem {
    id: string
    title: string
    thumbnail_url: string | null
    category: string
    grade_level: string | null
    price: number
    students_count: number
    instructor_name: string
    instructor_verified: boolean
    duration: string | null
    created_ms: number
}

// Stale-while-revalidate cache: show the last list instantly, then refresh from Firestore.
const CACHE_KEY = "manara:courses-list:v1"
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

function readCache(): CourseListItem[] | null {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.courses) || typeof parsed.at !== "number") return null
        if (Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null
        return parsed.courses as CourseListItem[]
    } catch {
        return null
    }
}

function writeCache(courses: CourseListItem[]) {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), courses }))
    } catch {
        // storage full / disabled — ignore
    }
}

function toMillis(value: any): number {
    if (!value) return 0
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const t = new Date(value).getTime()
        return Number.isFinite(t) ? t : 0
    }
    if (typeof value.toMillis === "function") return value.toMillis()
    if (typeof value.seconds === "number") return value.seconds * 1000
    return 0
}

function toListItem(id: string, data: any): CourseListItem {
    const students = Number(data.students_count || 0)
    const price = Number(data.price || 0)
    return {
        id,
        title: String(data.title || ""),
        thumbnail_url: data.thumbnail_url || null,
        category: data.category || "other",
        grade_level: data.grade_level || data.gradeLevel || null,
        price: Number.isFinite(price) ? price : 0,
        students_count: Number.isFinite(students) ? students : 0,
        instructor_name: data.instructor_name || "مدرس المنصة",
        instructor_verified: !!data.instructor_verified,
        duration: data.duration || null,
        created_ms: toMillis(data.created_at),
    }
}

// useLayoutEffect on the client so cached cards paint before the skeleton is ever shown.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

export default function CoursesPage() {
    const [selectedCategory, setSelectedCategory] = useState("الكل")
    const [selectedGrade, setSelectedGrade] = useState("الكل")
    const [sortOrder, setSortOrder] = useState("latest")
    const [searchQuery, setSearchQuery] = useState("")
    const [courses, setCourses] = useState<CourseListItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useIsomorphicLayoutEffect(() => {
        const cached = readCache()
        if (cached && cached.length > 0) {
            setCourses(cached)
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        async function fetchCourses() {
            try {
                // Same "published" rule as the enroll / payment APIs: approved and not explicitly unpublished.
                const q = query(collection(db, "courses"), where("status", "==", "approved"))
                const querySnapshot = await getDocs(q)
                const fresh = querySnapshot.docs
                    .filter((d) => isPublishedCourse(d.data()))
                    .map((d) => toListItem(d.id, d.data()))
                if (cancelled) return
                setCourses(fresh)
                writeCache(fresh)
            } catch (error) {
                console.error("Error fetching courses:", error)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }
        fetchCourses()
        return () => {
            cancelled = true
        }
    }, [])

    const normalizedQuery = searchQuery.trim().toLowerCase()
    const filteredAndSortedCourses = courses
        .filter(course => {
            const matchesCategory = selectedCategory === "الكل" || course.category === selectedCategory
            const matchesGrade = selectedGrade === "الكل" || course.grade_level === selectedGrade
            const matchesSearch = !normalizedQuery
                || course.title.toLowerCase().includes(normalizedQuery)
                || course.instructor_name.toLowerCase().includes(normalizedQuery)
                || (CATEGORY_MAP[course.category] || "").includes(normalizedQuery)
            return matchesCategory && matchesGrade && matchesSearch
        })
        .sort((a, b) => {
            if (sortOrder === "price-asc") return a.price - b.price
            if (sortOrder === "price-desc") return b.price - a.price
            return b.created_ms - a.created_ms
        })

    const resetFilters = () => {
        setSelectedCategory("الكل")
        setSelectedGrade("الكل")
        setSortOrder("latest")
        setSearchQuery("")
    }

    return (
        <div className="flex min-h-screen flex-col overflow-x-clip">
            <Navbar />
            <main className="flex-1 container py-6 sm:py-10">
                <div className="flex flex-col space-y-6 sm:space-y-8">
                    {/* Header & Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">تصفح الكورسات</h1>
                            <p className="text-muted-foreground font-medium">اكتشف أفضل الكورسات لتعزيز مهاراتك اليوم</p>
                        </div>
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                type="search"
                                placeholder="ابحث عن كورس، مدرس أو مادة..."
                                className="pr-10 h-12 rounded-xl border-muted-foreground/20 focus:border-primary transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="flex items-center gap-2 sm:gap-3 bg-muted/30 p-2 rounded-2xl border border-muted min-w-0">
                        {/* Phones: one scrollable row of chips instead of 3–4 wrapped lines */}
                        <div className="flex flex-1 min-w-0 gap-2 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible">
                            {CATEGORIES.map((category) => (
                                <Button
                                    key={category}
                                    variant={selectedCategory === category ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setSelectedCategory(category)}
                                    aria-pressed={selectedCategory === category}
                                    className={`shrink-0 whitespace-nowrap h-11 md:h-9 rounded-xl px-4 font-bold transition-all ${selectedCategory === category ? "shadow-md shadow-primary/20" : "hover:bg-background"}`}
                                >
                                    {category === "الكل" ? "الكل" : (CATEGORY_MAP[category] || category)}
                                </Button>
                            ))}
                        </div>

                        <div className="h-8 w-px bg-muted hidden md:block" />

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="shrink-0 h-11 md:h-9 gap-2 rounded-xl font-bold border-primary/20 hover:bg-primary/5 hover:text-primary" aria-label="تصفية متقدمة">
                                    <Filter className="h-4 w-4" />
                                    <span className="hidden sm:inline">تصفية متقدمة</span>
                                    {(selectedGrade !== "الكل" || sortOrder !== "latest") && (
                                        <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                            !
                                        </Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] max-w-[85vw] sm:w-[400px]">
                                <SheetHeader>
                                    <SheetTitle className="text-right font-black text-2xl">تصفية متقدمة</SheetTitle>
                                    <SheetDescription className="text-right font-medium">قم بتخصيص نتائج البحث بدقة</SheetDescription>
                                </SheetHeader>

                                <div className="space-y-8 py-8 px-4" dir="rtl">
                                    {/* Grade Filter */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-black flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-primary" />
                                            الصف الدراسي
                                        </label>
                                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                            <SelectTrigger className="w-full rounded-xl h-11">
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
                                            <SelectTrigger className="w-full rounded-xl h-11">
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
                                        className="w-full h-11 rounded-xl gap-2 font-bold text-destructive hover:bg-destructive/5 border-destructive/20"
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8" aria-busy="true">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Card key={i} className="overflow-hidden border-muted/60 flex flex-col gap-0 py-0">
                                    <Skeleton className="w-full aspect-video" />
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <Skeleton className="h-5 w-20 rounded-full" />
                                            <Skeleton className="h-4 w-12" />
                                        </div>
                                        <Skeleton className="h-6 w-full rounded-md" />
                                        <Skeleton className="h-4 w-3/4 rounded-md" />
                                        <div className="pt-4 border-t flex justify-between items-center">
                                            <Skeleton className="h-6 w-24 rounded-md" />
                                            <Skeleton className="h-9 w-24 rounded-lg" />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                            {filteredAndSortedCourses.map((course, index) => (
                                <CourseCard key={course.id} course={course} eager={index < 3} />
                            ))}
                        </div>
                    )}
                </div>

                {!isLoading && filteredAndSortedCourses.length === 0 && (
                    <div className="text-center py-20 sm:py-32 px-4 border-2 border-dashed rounded-3xl bg-muted/20">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xl font-black mb-2">لم نجد أي نتائج!</h3>
                        <p className="text-muted-foreground font-medium mb-6">جرب تغيير كلمات البحث أو إزالة بعض الفلاتر المتقدمة</p>
                        <Button variant="outline" onClick={resetFilters} className="h-11 rounded-xl font-bold">إعادة الضبط</Button>
                    </div>
                )}
            </main>
        </div>
    )
}

function CourseCard({ course, eager }: { course: CourseListItem; eager?: boolean }) {
    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow border-muted/60 gap-0 py-0">
            <Link href={`/courses/${course.id}`} className="block aspect-video relative overflow-hidden bg-muted" tabIndex={-1} aria-hidden="true">
                <img
                    src={getCourseThumbnailUrl(course.thumbnail_url)}
                    alt=""
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                    width={640}
                    height={360}
                    className="object-cover w-full h-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:scale-105"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-2 items-end z-10">
                    <Badge className="bg-primary/95 text-primary-foreground backdrop-blur-sm shadow-md">{CATEGORY_MAP[course.category] || course.category}</Badge>
                    {course.grade_level && (
                        <Badge variant="secondary" className="bg-white/95 text-black border-none text-[10px] shadow-sm">
                            {GRADE_MAP[course.grade_level] || course.grade_level}
                        </Badge>
                    )}
                </div>
            </Link>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg line-clamp-2 min-h-[3.5rem] leading-snug">{course.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center text-sm text-foreground font-bold min-w-0">
                    <User className="ml-2 h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{course.instructor_name}</span>
                    {course.instructor_verified && (
                        <CheckCircle2 className="mr-1.5 h-4 w-4 shrink-0 text-blue-500 fill-blue-50" />
                    )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center">
                        <Clock className="ml-1 h-3.5 w-3.5" />
                        {course.duration || "جاري التحديد"}
                    </div>
                    {course.students_count > 0 ? (
                        <div className="flex items-center">
                            <BookOpen className="ml-1 h-3.5 w-3.5" />
                            {course.students_count} طالب
                        </div>
                    ) : (
                        <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary text-[11px] font-bold">
                            <Sparkles className="h-3 w-3" />
                            جديد
                        </Badge>
                    )}
                </div>
            </CardContent>
            <CardFooter className="p-4 border-t flex flex-col gap-3">
                <div className="w-full flex items-center justify-between gap-3">
                    <span className="font-black text-xl text-primary whitespace-nowrap">{course.price || 0} ج.م</span>
                    <Button asChild className="h-11 rounded-xl font-bold shadow-md shadow-primary/20">
                        <Link href={`/courses/${course.id}`}>تفاصيل الكورس</Link>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
