"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Phone, Mail, GraduationCap, School, Save, Loader2, AlertTriangle, ArrowRight, Camera } from "lucide-react"
import { toast } from "sonner"
import { FileUploader } from "@/components/file-uploader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function StudentProfilePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>({
        full_name: "",
        phone: "",
        parent_phone: "",
        grade_level: "",
        school_name: "",
        avatar_url: ""
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser)
                const docRef = doc(db, "profiles", currentUser.uid)
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                    setProfile(docSnap.data())
                }
                setIsLoading(false)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [router])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setIsSaving(true)
        try {
            await updateDoc(doc(db, "profiles", user.uid), {
                ...profile,
                status: 'pending', // Re-trigger approval
                updated_at: new Date().toISOString()
            })
            toast.success("تم تحديث البيانات بنجاح. حسابك الآن قيد المراجعة.")
            router.push("/pending-approval")
        } catch (error) {
            console.error("Profile update error:", error)
            toast.error("حدث خطأ أثناء تحديث البيانات")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/20 pb-20 font-arabic border-t selection:bg-primary/10">
            <div className="max-w-3xl mx-auto px-4 pt-12">
                <Button
                    variant="ghost"
                    className="mb-8 gap-2 hover:bg-background transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowRight className="h-4 w-4" />
                    العودة
                </Button>

                <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-foreground tracking-tight">إعدادات الملف الشخصي</h1>
                            <p className="text-muted-foreground mt-2 font-medium">قم بتحديث بياناتك وتأكد من صحتها.</p>
                        </div>
                    </div>

                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="font-bold">تنبيه هام</AlertTitle>
                        <AlertDescription className="text-xs font-bold mt-1">
                            عند حفظ أي تعديلات، سيتم وضع حسابك في مرحلة "المراجعة" مرة أخرى ولن يمكنك الوصول للمحتوى حتى يوافق الأدمن على التعديلات.
                        </AlertDescription>
                    </Alert>

                    <form onSubmit={handleSave} className="space-y-8">
                        <Card className="border-2 shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="flex items-center gap-2">
                                    <Camera className="h-5 w-5 text-primary" />
                                    الصورة الشخصية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-8">
                                <div className="flex flex-col items-center gap-6">
                                    <div className="h-32 w-32 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted flex items-center justify-center relative group">
                                        {profile.avatar_url ? (
                                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-12 w-12 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="w-full max-w-sm">
                                        <FileUploader
                                            label="تغيير الصورة الشخصية"
                                            folder="avatars"
                                            accept="image/*"
                                            onUploadComplete={(url) => setProfile({ ...profile, avatar_url: url })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-2 shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    المعلومات الأساسية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name" className="font-bold">الاسم الكامل</Label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="full_name"
                                            className="pr-10 h-11"
                                            value={profile.full_name}
                                            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="font-bold">رقم الهاتف</Label>
                                    <div className="relative">
                                        <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="phone"
                                            className="pr-10 h-11"
                                            value={profile.phone}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="parent_phone" className="font-bold">رقم هاتف ولي الأمر</Label>
                                    <div className="relative">
                                        <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="parent_phone"
                                            className="pr-10 h-11"
                                            value={profile.parent_phone}
                                            onChange={(e) => setProfile({ ...profile, parent_phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="font-bold">البريد الإلكتروني (للقراءة فقط)</Label>
                                    <div className="relative">
                                        <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            className="pr-10 h-11 bg-muted/50"
                                            value={profile.email}
                                            disabled
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-2 shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="flex items-center gap-2">
                                    <School className="h-5 w-5 text-primary" />
                                    المعلومات الدراسية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="grade_level" className="font-bold">السنة الدراسية</Label>
                                    <div className="relative">
                                        <GraduationCap className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="grade_level"
                                            className="pr-10 h-11"
                                            value={profile.grade_level}
                                            onChange={(e) => setProfile({ ...profile, grade_level: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="school_name" className="font-bold">المدرسة</Label>
                                    <div className="relative">
                                        <School className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="school_name"
                                            className="pr-10 h-11"
                                            value={profile.school_name}
                                            onChange={(e) => setProfile({ ...profile, school_name: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t p-6 flex justify-end">
                                <Button size="lg" className="px-10 gap-2 h-12 font-bold" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    حفظ البيانات ومراجعة الحساب
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>
            </div>
        </div>
    )
}
