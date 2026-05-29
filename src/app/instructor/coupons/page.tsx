"use client"

import { useState, useEffect } from "react"
import { db, auth } from "@/lib/firebase/config"
import { 
    collection, 
    query, 
    getDocs, 
    doc, 
    addDoc, 
    deleteDoc, 
    updateDoc,
    orderBy, 
    where
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
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
    Activity,
    Calendar
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

export default function InstructorCouponsPage() {
    const [coupons, setCoupons] = useState<any[]>([])
    const [courses, setCourses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [user, setUser] = useState<any>(null)

    // Form states
    const [code, setCode] = useState("")
    const [discountPercent, setDiscountPercent] = useState("")
    const [maxUses, setMaxUses] = useState("100")
    const [targetCourse, setTargetCourse] = useState("")

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u)
                fetchData(u.uid)
            }
        })
        return () => unsubscribe()
    }, [])

    async function fetchData(uid: string) {
        setLoading(true)
        try {
            // Fetch Courses for the dropdown (only instructor's courses)
            const coursesQ = query(collection(db, "courses"), where("instructor_id", "==", uid))
            const coursesSnap = await getDocs(coursesQ)
            const myCourses = coursesSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title }))
            setCourses(myCourses)
            
            if (myCourses.length > 0) {
                setTargetCourse(myCourses[0].id)
            }

            // Fetch Coupons created by this instructor
            const couponsQ = query(
                collection(db, "coupons"), 
                where("instructor_id", "==", uid)
            )
            const couponsSnap = await getDocs(couponsQ)
            setCoupons(couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        } catch (error) {
            console.error("Error fetching data:", error)
            toast.error("حدث خطأ أثناء تحميل البيانات")
        } finally {
            setLoading(false)
        }
    }

    const handleAddCoupon = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return
        if (!code || !discountPercent || !targetCourse) {
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
            // Check if code already exists globally
            const existingQ = query(collection(db, "coupons"), where("code", "==", code.toUpperCase()))
            const existingSnap = await getDocs(existingQ)
            if (!existingSnap.empty) {
                toast.error("هذا الكود مستخدم بالفعل")
                setIsSaving(false)
                return
            }

            const courseTitle = courses.find(c => c.id === targetCourse)?.title

            const newCoupon = {
                code: code.toUpperCase(),
                discount_percent: percentNum,
                max_uses: Number(maxUses) || 100,
                course_id: targetCourse,
                course_title: courseTitle,
                instructor_id: user.uid,
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
        <div className="font-arabic space-y-8 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black italic">إدارة الكوبونات 🎫</h1>
                    <p className="text-muted-foreground mt-1 italic">أنشئ عروضك الخاصة لجذب المزيد من الطلاب لكورساتك</p>
                </div>
                <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                    <Ticket className="h-8 w-8" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Area */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <div className="flex items-center gap-2">
                                <Plus className="h-5 w-5 text-primary" />
                                <CardTitle className="text-xl font-bold">إنشاء كود خصم</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleAddCoupon} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="code" className="font-bold">كود الخصم</Label>
                                    <Input 
                                        id="code"
                                        placeholder="مثلاً: PROMO20"
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
                                            placeholder="20"
                                            value={discountPercent}
                                            onChange={(e) => setDiscountPercent(e.target.value)}
                                            className="pl-10 h-11 font-bold rtl:pr-4"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="maxUses" className="font-bold text-xs text-muted-foreground italic">أقصى عدد استخدام (اختياري)</Label>
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
                                    <Label className="font-bold">تطبيق على كورس:</Label>
                                    <Select value={targetCourse} onValueChange={setTargetCourse}>
                                        <SelectTrigger className="h-11 border-primary/20">
                                            <SelectValue placeholder="اختر الكورس" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courses.map(course => (
                                                <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground italic mt-1">ملاحظة: يمكنك إنشاء كوبون لكورساتك فقط.</p>
                                </div>

                                <Button 
                                    type="submit" 
                                    className="w-full h-12 font-black text-lg gap-2 shadow-lg shadow-primary/20"
                                    disabled={isSaving || courses.length === 0}
                                >
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                    تفعيل الكود الجديد
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-2">
                        <h4 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            نصيحة تسويقية
                        </h4>
                        <p className="text-[10px] text-amber-900 leading-relaxed font-medium">
                            استخدام كوبونات الخصم لفترات محدودة يزيد من حماس الطلاب للالتحاق بالكورس. جرب إنشاء أكواد لـ 50 طالباً فقط لخلق نوع من "الاستعجال" (Urgency).
                        </p>
                    </div>
                </div>

                {/* List Area */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-lg border-none overflow-hidden">
                        <CardHeader className="bg-muted/30 flex flex-row items-center justify-between space-y-0 pb-7">
                            <CardTitle className="text-xl font-bold">أكواد الخصم الحالية</CardTitle>
                            <div className="relative w-full max-w-[200px]">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="بحث بالكود..."
                                    className="pr-10 h-9 rounded-full bg-background border-none focus:ring-1 focus:ring-primary/20 ring-1 ring-muted transition-all text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <p className="font-bold text-muted-foreground">جاري تحميل بياناتك...</p>
                                </div>
                            ) : filteredCoupons.length > 0 ? (
                                <div className="grid gap-4">
                                    {filteredCoupons.map((coupon) => (
                                        <div 
                                            key={coupon.id}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border-2 border-muted hover:border-primary/20 hover:bg-primary/5 transition-all gap-4 bg-white"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 bg-primary/10 rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center shrink-0">
                                                    <span className="text-primary font-black text-lg">{coupon.discount_percent}%</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-black tracking-widest font-mono text-primary">{coupon.code}</h3>
                                                        <Badge variant={coupon.active ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                                                            {coupon.active ? "نشط" : "متوقف"}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-1">
                                                            <BookOpen className="h-3 w-3" />
                                                            {coupon.course_title}
                                                        </div>
                                                        <div className="flex items-center gap-1 font-bold text-green-600">
                                                            <Activity className="h-3 w-3" />
                                                            {coupon.usage_count} / {coupon.max_uses || "∞"} استخدام
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                                                            <Calendar className="h-3 w-3" />
                                                            أنشئ في: {coupon.created_at ? new Date(coupon.created_at).toLocaleDateString('ar-EG') : "تاريخ قديم"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border">
                                                    <span className="text-[10px] font-bold text-muted-foreground">تفعيل</span>
                                                    <Switch 
                                                        checked={coupon.active} 
                                                        onCheckedChange={() => handleToggleActive(coupon.id, coupon.active)}
                                                        className="scale-75"
                                                    />
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                    onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5">
                                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Ticket className="h-8 w-8 text-muted-foreground/30" />
                                    </div>
                                    <h3 className="font-black text-lg">لم تنشئ أي أكواد بعد</h3>
                                    <p className="text-muted-foreground text-sm italic">ابدأ بملء النموذج الجانبي لإطلاق أول عرض خصم لطلابك!</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
