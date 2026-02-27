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
    Bell
} from "lucide-react"
import { toast } from "sonner"

export default function AdminSettingsPage() {
    const handleSave = () => {
        toast.success("تم حفظ الإعدادات بنجاح (نسخة تجريبية)")
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
                                <Input defaultValue="أكاديمية المنارة" />
                            </div>
                            <div className="space-y-2">
                                <Label>البريد الإلكتروني للدعم</Label>
                                <Input defaultValue="support@manara.com" dir="ltr" />
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
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                            <div className="space-y-0.5">
                                <Label className="text-base">مراجعة الحسابات الجديدة</Label>
                                <p className="text-xs text-muted-foreground">يتطلب تفعيل يدوي من الأدمن لكل مستخدم جديد (مفعل حالياً)</p>
                            </div>
                            <Switch checked={true} />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                            <div className="space-y-0.5">
                                <Label className="text-base">علامة مائية ديناميكية</Label>
                                <p className="text-xs text-muted-foreground">إظهار إيميل الطالب فوق الفيديو لمنع التصوير</p>
                            </div>
                            <Switch checked={true} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                            <Database className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>الاشتراكات والعمولات</CardTitle>
                            <CardDescription>تحكم في نسب المنصة من المبيعات</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>عمولة المنصة الإفتراضية (%)</Label>
                                <Input type="number" defaultValue="20" />
                            </div>
                            <div className="space-y-2">
                                <Label>الحد الأدنى للسحب (ج.م)</Label>
                                <Input type="number" defaultValue="500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <Button variant="outline">إعادة تعيين</Button>
                    <Button className="gap-2 px-8" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                        حفظ كافة الإعدادات
                    </Button>
                </div>
            </div>
        </div>
    )
}
