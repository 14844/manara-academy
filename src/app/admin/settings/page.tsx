"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Settings as SettingsIcon,
    Save,
    Globe,
    Shield,
    MessageSquare,
    Database,
    Bell,
    Loader2
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getSupportSettings, SupportSettings } from "@/lib/support-settings"
import { updateSupportAction } from "@/app/actions/support"

export default function AdminSettingsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [settings, setSettings] = useState<SupportSettings>({
        phone: "",
        email: ""
    })

    useEffect(() => {
        async function loadSettings() {
            try {
                const data = await getSupportSettings()
                setSettings(data)
            } catch (error) {
                console.error("Load settings error:", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadSettings()
    }, [])

    const handleSave = async () => {
        try {
            const res = await updateSupportAction(settings)
            if (res.success) {
                toast.success("تم تحديث إعدادات الدعم بنجاح")
            } else {
                throw new Error(res.error)
            }
        } catch (error) {
            console.error("Save error:", error)
            toast.error("فشل في حفظ الإعدادات")
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic">
            <div>
                <h1 className="text-3xl font-bold">إعدادات المنصة</h1>
                <p className="text-muted-foreground italic">تخصيص القواعد والخيارات العامة للأكاديمية</p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>الإعدادات العامة</CardTitle>
                            <CardDescription>الاسم اللفظي وشعارات المنصة</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>اسم المنصة</Label>
                                <Input defaultValue="أكاديمية المنارة" disabled />
                            </div>
                            <div className="space-y-2 text-primary font-bold">
                                <Label>تنبيه</Label>
                                <p className="text-xs">تعديل هذه البيانات سيؤثر على كامل المنصة فوراً.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-4 border-b bg-primary/5 pb-4">
                        <div className="p-2 rounded-lg bg-green-100 text-green-600">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>بيانات الدعم والتواصل</CardTitle>
                            <CardDescription>البيانات التي تظهر للطلاب في زر الواتساب والـ Footer</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">رقم هاتف الدعم (واتساب)</Label>
                                <Input 
                                    value={settings.phone} 
                                    onChange={(e) => setSettings({...settings, phone: e.target.value})}
                                    placeholder="مثال: 201017333215"
                                    dir="ltr"
                                />
                                <p className="text-[10px] text-muted-foreground italic">ملاحظة: ابدأ بكود الدولة بدون علامة + (مثال: مصر 20)</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">البريد الإلكتروني للدعم</Label>
                                <Input 
                                    value={settings.email}
                                    onChange={(e) => setSettings({...settings, email: e.target.value})}
                                    placeholder="support@example.com"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>الأمان والتسجيل</CardTitle>
                            <CardDescription>إدارة تفعيل المستخدمين الجدد</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg opacity-60">
                            <div className="space-y-0.5">
                                <Label className="text-base">مراجعة الحسابات الجديدة</Label>
                                <p className="text-xs text-muted-foreground">يتطلب تفعيل يدوي من الأدمن لكل مستخدم جديد (مفعل حالياً)</p>
                            </div>
                            <Switch checked={true} disabled />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg opacity-60">
                            <div className="space-y-0.5">
                                <Label className="text-base">علامة مائية ديناميكية</Label>
                                <p className="text-xs text-muted-foreground">إظهار إيميل الطالب فوق الفيديو لمنع التصوير</p>
                            </div>
                            <Switch checked={true} disabled />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => window.location.reload()}>إلغاء التعديلات</Button>
                    <Button className="gap-2 px-8" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                        حفظ كافة الإعدادات
                    </Button>
                </div>
            </div>
        </div>
    )
}
