"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    User,
    Settings as SettingsIcon,
    Mail,
    Phone,
    BookOpen,
    ShieldCheck,
    Loader2,
    Lock,
    Camera,
    Sparkles
} from "lucide-react"
import { AvatarCropUploader } from "@/components/avatar-crop-uploader"

export default function InstructorSettingsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>({
        full_name: "",
        specialty: "",
        bio: "",
        phone: "",
        email: "",
        avatar_url: ""
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const res = await fetch("/api/profile/me")
                    if (res.ok) {
                        const data = await res.json()
                        setProfile({
                            full_name: data.full_name || "",
                            specialty: data.specialty || "",
                            bio: data.bio || "",
                            phone: data.phone || "",
                            email: data.email || user.email || "",
                            avatar_url: data.avatar_url || ""
                        })
                    } else {
                        const docRef = doc(db, "profiles", user.uid)
                        const docSnap = await getDoc(docRef)
                        if (docSnap.exists()) {
                            const pData = docSnap.data()
                            setProfile({
                                ...pData,
                                email: user.email || "",
                                avatar_url: pData.avatar_url || ""
                            })
                        }
                    }
                } catch {
                    const docRef = doc(db, "profiles", user.uid)
                    const docSnap = await getDoc(docRef)
                    if (docSnap.exists()) {
                        const pData = docSnap.data()
                        setProfile({
                            ...pData,
                            email: user.email || "",
                            avatar_url: pData.avatar_url || ""
                        })
                    }
                }
                setIsLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center font-arabic">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="text-sm font-bold text-muted-foreground">جاري تحميل بيانات المدرب...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500 max-w-4xl mx-auto pb-16">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>لوحة المدرب المعتمد</span>
                    </div>
                    <h1 className="text-3xl font-black text-foreground">الإعدادات والملف الشخصي ⚙️</h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        يمكنك تغيير صورتك الشخصية وقصها بسهولة. بياناتك المهنية معتمدة من الإدارة.
                    </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
                    <SettingsIcon className="h-8 w-8" />
                </div>
            </div>

            {/* Read-Only Notice */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5 flex items-start gap-3.5 shadow-xs">
                <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0 mt-0.5">
                    <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-right">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <span>بيانات الحساب معتمدة وموثقة</span>
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        البيانات الأكاديمية والمهنية للمدرب (الاسم، التخصص، النبذة التعريفية، وبيانات التواصل) معتمدة ورسمية ومقفلة للحفاظ على موثوقية الكورسات لدى الطلاب وأولياء الأمور. لتعديل أي بيان، يرجى التنسيق مع إدارة المنصة.
                    </p>
                </div>
            </div>

            {/* Avatar Section */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <Camera className="h-5 w-5 text-primary" />
                        الصورة الشخصية للمدرب
                    </CardTitle>
                    <CardDescription className="text-xs">
                        تظهر هذه الصورة في صفحة تفاصيل الكورس ومحادثات الطلاب. انقر لاختيار صورة وقصّها مباشرة.
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

            {/* Basic Info (Read-Only) */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <User className="h-5 w-5 text-primary" />
                        المعلومات الأساسية
                    </CardTitle>
                    <CardDescription className="text-xs">تظهر هذه البيانات للطلاب في صفحات الكورسات الخاصة بك</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                <span>الاسم الكامل</span>
                                <Lock className="h-3 w-3 text-muted-foreground/60" />
                            </Label>
                            <div className="relative">
                                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pr-10 h-12 bg-muted/40 border-muted-foreground/20 rounded-xl cursor-not-allowed font-medium select-all"
                                    value={profile.full_name || "—"}
                                    readOnly
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                <span>التخصص الدراسي</span>
                                <Lock className="h-3 w-3 text-muted-foreground/60" />
                            </Label>
                            <div className="relative">
                                <BookOpen className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pr-10 h-12 bg-muted/40 border-muted-foreground/20 rounded-xl cursor-not-allowed font-medium select-all"
                                    value={profile.specialty || "—"}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                            <span>النبذة التعريفية (Bio)</span>
                            <Lock className="h-3 w-3 text-muted-foreground/60" />
                        </Label>
                        <Textarea
                            className="min-h-[110px] bg-muted/40 border-muted-foreground/20 rounded-xl resize-none leading-relaxed cursor-not-allowed font-medium select-all"
                            value={profile.bio || "—"}
                            readOnly
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Contact Info (Read-Only) */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        معلومات التواصل والحساب
                    </CardTitle>
                    <CardDescription className="text-xs">بيانات الأمان الخاصة بحسابك</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                <span>البريد الإلكتروني</span>
                                <Lock className="h-3 w-3 text-muted-foreground/60" />
                            </Label>
                            <div className="relative">
                                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    dir="ltr"
                                    className="pr-10 h-12 bg-muted/40 border-muted-foreground/20 rounded-xl font-mono text-sm cursor-not-allowed select-all text-right"
                                    value={profile.email || "—"}
                                    readOnly
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center justify-between text-muted-foreground">
                                <span>رقم الهاتف المعتمد</span>
                                <Lock className="h-3 w-3 text-muted-foreground/60" />
                            </Label>
                            <div className="relative">
                                <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    dir="ltr"
                                    className="pr-10 h-12 bg-muted/40 border-muted-foreground/20 rounded-xl font-mono text-sm cursor-not-allowed select-all text-right"
                                    value={profile.phone || "—"}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
