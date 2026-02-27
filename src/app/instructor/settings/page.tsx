"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    User,
    Settings as SettingsIcon,
    Save,
    Mail,
    Phone,
    BookOpen,
    ShieldCheck,
    Loader2
} from "lucide-react"
import { toast } from "sonner"

export default function InstructorSettingsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [profile, setProfile] = useState<any>({
        full_name: "",
        specialty: "",
        bio: "",
        phone: "",
        email: ""
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, "profiles", user.uid)
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                    setProfile({
                        ...docSnap.data(),
                        email: user.email
                    })
                }
                setIsLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const user = auth.currentUser
            if (!user) return

            await updateDoc(doc(db, "profiles", user.uid), {
                full_name: profile.full_name,
                specialty: profile.specialty,
                bio: profile.bio,
                phone: profile.phone,
                updated_at: new Date().toISOString()
            })

            toast.success("تم تحديث البروفايل بنجاح")
        } catch (error) {
            console.error("Update error:", error)
            toast.error("فشل في تحديث البيانات")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black">الإعدادات الشخصية ⚙️</h1>
                    <p className="text-muted-foreground mt-1 italic">إدارة بياناتك الشخصية وتفاصيل عملك كمدرب</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <SettingsIcon className="h-8 w-8" />
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <Card className="border-2 shadow-xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            المعلومات الأساسية
                        </CardTitle>
                        <CardDescription>تظهر هذه البيانات للطلاب في صفحة الكورس</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">الاسم الكامل</Label>
                                <div className="relative">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pr-10 h-12 rounded-xl focus-visible:ring-primary/20"
                                        value={profile.full_name}
                                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">التخصص الدراسي</Label>
                                <div className="relative">
                                    <BookOpen className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="مثال: مدرس فيزياء للمرحلة الثانوية"
                                        className="pr-10 h-12 rounded-xl focus-visible:ring-primary/20"
                                        value={profile.specialty}
                                        onChange={(e) => setProfile({ ...profile, specialty: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-bold">النبذة التعريفية (Bio)</Label>
                            <Textarea
                                className="min-h-[120px] rounded-xl focus-visible:ring-primary/20 resize-none leading-relaxed"
                                placeholder="تحدث عن خبرتك الأكاديمية ومهاراتك التدريسية..."
                                value={profile.bio}
                                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                required
                            />
                            <p className="text-[10px] text-muted-foreground">تساعدك النبذة التعريفية الجيدة في كسب ثقة الطلاب وأولياء الأمور.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                            معلومات التواصل والأمان
                        </CardTitle>
                        <CardDescription>هذه البيانات تستخدم لإدارة حسابك ولا تظهر للعامة</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">البريد الإلكتروني</Label>
                                <div className="relative">
                                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pr-10 h-12 bg-muted/50 rounded-xl"
                                        readOnly
                                        value={profile.email}
                                        disabled
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">رقم الهاتف</Label>
                                <div className="relative">
                                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pr-10 h-12 rounded-xl focus-visible:ring-primary/20"
                                        value={profile.phone}
                                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/10 p-6 border-t flex justify-end">
                        <Button
                            type="submit"
                            className="gap-2 px-10 h-12 rounded-xl shadow-lg hover:shadow-primary/20 transition-all font-bold"
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            حفظ التعديلات
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    )
}
