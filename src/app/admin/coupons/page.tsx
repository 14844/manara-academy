"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { 
    collection, 
    query, 
    getDocs, 
    doc, 
    addDoc, 
    deleteDoc, 
    updateDoc,
    orderBy, 
    serverTimestamp,
    where
} from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    Ticket, 
    Plus, 
    Trash2, 
    Search, 
    Loader2, 
    Percent, 
    BookOpen, 
    CheckCircle2, 
    Layers,
    Power,
    Activity
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function AdminCouponsPage() {
    const [coupons, setCoupons] = useState<any[]>([])
    const [courses, setCourses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // Form states
    const [code, setCode] = useState("")
    const [discountPercent, setDiscountPercent] = useState("")
    const [maxUses, setMaxUses] = useState("100")
    const [targetCourse, setTargetCourse] = useState("all")

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            // Fetch Coupons
            const couponsQ = query(collection(db, "coupons"), orderBy("created_at", "desc"))
            const couponsSnap = await getDocs(couponsQ)
            setCoupons(couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))

            // Fetch Courses for the dropdown
            const coursesSnap = await getDocs(collection(db, "courses"))
            setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title })))
        } catch (error) {
            console.error("Error fetching data:", error)
            toast.error("حدث خطأ أثناء تحميل البيانات")
        } finally {
            setLoading(false)
        }
    }

    const handleAddCoupon = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!code || !discountPercent) {
            toast.error("يرجى ملء كافة الحقول المطلوبة")
            return
        }

        const percentNum = Number(discountPercent)
        if (percentNum <= 0 || percentNum > 100) {
            toast.error("النسبة المئوية يجب أن تكون بين 1 و 100")
            return
        }

        setIsSaving(true)
        try {
            // Check if code already exists
            const existingQ = query(collection(db, "coupons"), where("code", "==", code.toUpperCase()))
            const existingSnap = await getDocs(existingQ)
            if (!existingSnap.empty) {
                toast.error("هذا الكود مستخدم بالفعل")
                setIsSaving(false)
                return
            }

            const courseTitle = targetCourse === "all" ? "كافة الكورسات" : courses.find(c => c.id === targetCourse)?.title

            const newCoupon = {
                code: code.toUpperCase(),
                discount_percent: percentNum,
                max_uses: Number(maxUses) || 100,
                course_id: targetCourse,
                course_title: courseTitle,
                active: true,
                usage_count: 0,
                created_at: new Date().toISOString()
            }

            const docRef = await addDoc(collection(db, "coupons"), newCoupon)
            setCoupons([{ id: docRef.id, ...newCoupon }, ...coupons])
            
            toast.success("تم إنشاء الكوبون بنجاح")
            setCode("")
            setDiscountPercent("")
            setMaxUses("100")
            setTargetCourse("all")
        } catch (error) {
            console.error("Error adding coupon:", error)
            toast.error("حدث خطأ أثناء حفظ الكوبون")
        } finally {
            setIsSaving(false)
        }
    }

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, "coupons", id), {
                active: !currentStatus
            })
            setCoupons(coupons.map(c => c.id === id ? { ...c, active: !currentStatus } : c))
            toast.success(currentStatus ? "تم تعطيل الكوبون" : "تم تفعيل الكوبون")
        } catch (error) {
            console.error("Error toggling status:", error)
            toast.error("حدث خطأ أثناء تغيير حالة الكوبون")
        }
    }

    const handleDeleteCoupon = async (id: string, codeText: string) => {
        if (!confirm(`هل أنت متأكد من حذف الكوبون ${codeText}؟`)) return

        try {
            await deleteDoc(doc(db, "coupons", id))
            setCoupons(coupons.filter(c => c.id !== id))
            toast.success("تم حذف الكوبون بنجاح")
        } catch (error) {
            console.error("Error deleting coupon:", error)
            toast.error("حدث خطأ أثناء حذف الكوبون")
        }
    }

    const filteredCoupons = coupons.filter(c => 
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.course_title?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="font-arabic" dir="rtl">
            <div className="flex flex-col space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black tracking-tight text-primary">إدارة الكوبونات</h1>
                        <p className="text-muted-foreground font-medium">أنشئ أكواد خصم مئوية لكورسات المنصة</p>
                    </div>
                    <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                        <Ticket className="h-8 w-8" />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Summary & Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b border-primary/10">
                                <div className="flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-primary" />
                                    <CardTitle className="text-xl font-bold">إنشاء كوبون جديد</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleAddCoupon} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="code" className="font-bold">كود الخصم</Label>
                                        <Input 
                                            id="code"
                                            placeholder="مثلاً: OFF50"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            className="uppercase font-mono font-bold text-center h-12 text-lg border-primary/20 focus:border-primary"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="percent" className="font-bold">نسبة الخصم (%)</Label>
                                        <div className="relative">
                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="percent"
                                                type="number"
                                                placeholder="25"
                                                value={discountPercent}
                                                onChange={(e) => setDiscountPercent(e.target.value)}
                                                className="pl-10 h-11 font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="maxUses" className="font-bold text-xs">أقصى عدد استخدام</Label>
                                        <Input 
                                            id="maxUses"
                                            type="number"
                                            placeholder="100"
                                            value={maxUses}
                                            onChange={(e) => setMaxUses(e.target.value)}
                                            className="h-10 font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold">نطاق الخصم</Label>
                                        <Select value={targetCourse} onValueChange={setTargetCourse}>
                                            <SelectTrigger className="h-11 border-primary/20">
                                                <SelectValue placeholder="اختر النطاق" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all" className="font-bold text-primary">كافة الكورسات 🌍</SelectItem>
                                                {courses.map(course => (
                                                    <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button 
                                        type="submit" 
                                        className="w-full h-12 font-black text-lg gap-2 shadow-lg shadow-primary/20"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                        حفظ الكوبون
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                                <span className="text-muted-foreground text-xs font-bold">إجمالي الكوبونات</span>
                                <span className="text-3xl font-black text-primary">{coupons.length}</span>
                            </Card>
                            <Card className="p-4 flex flex-col items-center justify-center text-center space-y-1 bg-green-50/50">
                                <span className="text-muted-foreground text-xs font-bold">نشط حالياً</span>
                                <span className="text-3xl font-black text-green-600">{coupons.filter(c => c.active).length}</span>
                            </Card>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="shadow-lg border-none">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                                <CardTitle className="text-2xl font-black">قائمة الكوبونات</CardTitle>
                                <div className="relative w-full max-w-[240px]">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="بحث..."
                                        className="pr-10 h-10 rounded-full bg-muted/50 border-none focus:bg-background transition-all"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                        <p className="font-bold text-muted-foreground">جاري تحميل الكوبونات...</p>
                                    </div>
                                ) : filteredCoupons.length > 0 ? (
                                    <div className="grid gap-4">
                                        {filteredCoupons.map((coupon) => (
                                            <div 
                                                key={coupon.id}
                                                className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border-2 border-muted hover:border-primary/20 hover:bg-primary/5 transition-all gap-4"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="h-12 w-12 bg-background rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center shrink-0">
                                                        <span className="text-primary font-black text-lg">{coupon.discount_percent}%</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-lg font-black tracking-widest font-mono text-primary">{coupon.code}</h3>
                                                            <Badge variant={coupon.active ? "default" : "secondary"} className="text-[10px]">
                                                                {coupon.active ? "نشط" : "معطل"}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-1">
                                                                {coupon.course_id === 'all' ? <Layers className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                                                                {coupon.course_title}
                                                            </div>
                                                            <div className="flex items-center gap-1 font-bold">
                                                                <Activity className="h-3 w-3 text-green-500" />
                                                                {coupon.usage_count} / {coupon.max_uses || "∞"} استخدام
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg">
                                                        <span className="text-[10px] font-bold text-muted-foreground">{coupon.active ? "إيقاف" : "تفعيل"}</span>
                                                        <Switch 
                                                            checked={coupon.active} 
                                                            onCheckedChange={() => handleToggleActive(coupon.id, coupon.active)}
                                                        />
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                        onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Ticket className="h-8 w-8 text-muted-foreground/30" />
                                        </div>
                                        <h3 className="font-black text-lg">لا توجد كوبونات حالياً</h3>
                                        <p className="text-muted-foreground text-sm">يمكنك البدء بإنشاء أول كوبون خصم من خلال النموذج الجانبي.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
