"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    User, 
    Phone, 
    Mail, 
    GraduationCap, 
    School, 
    Loader2, 
    ArrowRight, 
    Camera, 
    ShieldCheck, 
    Lock,
    Sparkles
} from "lucide-react"
import { AvatarCropUploader } from "@/components/avatar-crop-uploader"

export default function StudentProfilePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>({
        full_name: "",
        phone: "",
        parent_phone: "",
        grade_level: "",
        school_name: "",
        avatar_url: "",
        email: ""
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    const res = await fetch("/api/profile/me")
                    if (res.ok) {
                        const data = await res.json()
                        setProfile({
                            full_name: data.full_name || "",
                            phone: data.phone || "",
                            parent_phone: data.parent_phone || "",
                            grade_level: data.grade_level || "",
                            school_name: data.school_name || "",
                            avatar_url: data.avatar_url || "",
                            email: data.email || currentUser.email || ""
                        })
                    } else {
                        const docRef = doc(db, "profiles", currentUser.uid)
                        const docSnap = await getDoc(docRef)
                        if (docSnap.exists()) {
                            const pData = docSnap.data()
                            setProfile({
                                ...pData,
                                email: currentUser.email || ""
                            })
                        }
                    }
                } catch {
                    const docRef = doc(db, "profiles", currentUser.uid)
                    const docSnap = await getDoc(docRef)
                    if (docSnap.exists()) {
                        const pData = docSnap.data()
                        setProfile({
                            ...pData,
                            email: currentUser.email || ""
                        })
                    }
                }
                setIsLoading(false)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [router])

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center font-arabic">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="text-sm font-bold text-muted-foreground">جاري تحميل بيانات الملف الشخصي...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/20 pb-20 font-arabic border-t selection:bg-primary/10">
            <div className="max-w-3xl mx-auto px-4 pt-10">
                <Button
                    variant="ghost"
                    className="mb-6 gap-2 hover:bg-background transition-colors font-bold text-muted-foreground hover:text-foreground"
                    onClick={() => router.back()}
                >
                    <ArrowRight className="h-4 w-4" />
                    العودة
                </Button>

                <div className="space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>حساب الطالب المعتمد</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">الملف الشخصي 🎓</h1>
                            <p className="text-muted-foreground mt-1 text-sm font-medium">
                                يمكنك تغيير صورتك الشخصية في أي وقت بكل سهولة.
                            </p>
                        </div>
                    </div>

                    {/* Notice: Read-only data */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5 flex items-start gap-3.5 shadow-xs">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0 mt-0.5">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 text-right">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <span>بياناتك الشخصية والأكاديمية موثقة</span>
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                للحفاظ على أمان وسرية الحساب وسجلات الاختبارات، فإن البيانات الأساسية للقراءة فقط. في حال أردت تحديث رقم الهاتف أو المدرسة أو السنة الدراسية، يرجى التواصل مع إدارة المنصة.
                            </p>
                        </div>
                    </div>

                    {/* Avatar Section */}
                    <Card className="border-2 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-bold">
                                <Camera className="h-5 w-5 text-primary" />
                                الصورة الشخصية
                            </CardTitle>
                            <CardDescription className="text-xs">
                                انقر على صورتك لاختيار صورة وقصّها وضبط موضعها وحفظها مباشرة.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8 pb-8 flex flex-col items-center">
                            <AvatarCropUploader
                                currentAvatarUrl={profile.avatar_url}
                                onAvatarUpdated={(newUrl) => {
                                    setProfile((prev: any) => ({ ...prev, avatar_url: newUrl }))
                                }}
                                label="اضغط لتغيير الصورة الشخصية"
                            />
                        </CardContent>
                    </Card>

                    {/* Academic & Personal Info (Read-Only) */}
                    <Card className="border-2 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-bold">
                                <User className="h-5 w-5 text-primary" />
                                المعلومات الأساسية
                            </CardTitle>
                            <CardDescription className="text-xs">
                                بيانات معتمدة من قِبل إدارة المنصة
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="full_name" className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                    <span>الاسم الكامل</span>
                                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <User className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="full_name"
                                        className="pr-10 h-11 bg-muted/40 border-muted-foreground/20 font-medium cursor-not-allowed select-all"
                                        value={profile.full_name || "—"}
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                    <span>البريد الإلكتروني</span>
                                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        dir="ltr"
                                        className="pr-10 h-11 bg-muted/40 border-muted-foreground/20 font-mono text-sm cursor-not-allowed select-all text-right"
                                        value={profile.email || "—"}
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                    <span>رقم هاتف الطالب</span>
                                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="phone"
                                        dir="ltr"
                                        className="pr-10 h-11 bg-muted/40 border-muted-foreground/20 font-mono text-sm cursor-not-allowed select-all text-right"
                                        value={profile.phone || "—"}
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="parent_phone" className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                    <span>رقم هاتف ولي الأمر</span>
                                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="parent_phone"
                                        dir="ltr"
                                        className="pr-10 h-11 bg-muted/40 border-muted-foreground/20 font-mono text-sm cursor-not-allowed select-all text-right"
                                        value={profile.parent_phone || "—"}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Academic Info */}
                    <Card className="border-2 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-bold">
                                <GraduationCap className="h-5 w-5 text-primary" />
                                المعلومات الدراسية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="grade_level" className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                    <span>السنة الدراسية</span>
                                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <GraduationCap className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="grade_level"
                                        className="pr-10 h-11 bg-muted/40 border-muted-foreground/20 font-medium cursor-not-allowed select-all"
                                        value={profile.grade_level || "—"}
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="school_name" className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                    <span>المدرسة</span>
                                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <School className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="school_name"
                                        className="pr-10 h-11 bg-muted/40 border-muted-foreground/20 font-medium cursor-not-allowed select-all"
                                        value={profile.school_name || "—"}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
