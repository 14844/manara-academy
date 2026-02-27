"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Plus,
    Trash2,
    Video,
    FileText,
    LayoutDashboard,
    Save,
    ArrowRight,
    Loader2,
    CheckCircle2,
    HelpCircle,
    ClipboardList,
    Upload
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { FileUploader } from "@/components/file-uploader"
import { QuestionBuilder } from "@/components/courses/question-builder"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"

export default function ManageCoursePage() {
    const { id } = useParams()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [course, setCourse] = useState<any>(null)
    const [modules, setModules] = useState<any[]>([])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login")
                return
            }
            fetchCourse()
        })
        return () => unsubscribe()
    }, [id])

    async function fetchCourse() {
        try {
            const docSnap = await getDoc(doc(db, "courses", id as string))
            if (docSnap.exists()) {
                const data = docSnap.data()
                setCourse(data)
                setModules(data.modules || [])
            } else {
                toast.error("الكورس غير موجود")
                router.push("/instructor")
            }
        } catch (error) {
            console.error("Error fetching course:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            console.log("Saving course data, thumbnail_url:", course?.thumbnail_url)
            await updateDoc(doc(db, "courses", id as string), {
                ...course,
                modules: modules,
                updated_at: new Date().toISOString()
            })
            toast.success("تم حفظ التعديلات بنجاح")
        } catch (error) {
            console.error("Save error:", error)
            toast.error("حدث خطأ أثناء الحفظ")
        } finally {
            setIsSaving(false)
        }
    }

    const addModule = () => {
        setModules([...modules, { id: Date.now(), title: "وحدة جديدة", lessons: [] }])
    }

    const addContent = (mIdx: number, type: 'video' | 'file' | 'assignment' | 'exam') => {
        const newModules = [...modules]
        const newItem: any = {
            id: Date.now(),
            type: type,
            title: type === 'video' ? "فيديو جديد" :
                type === 'file' ? "ملف جديد" :
                    type === 'assignment' ? "واجب جديد" : "اختبار جديد",
        }

        if (type === 'video' || type === 'file') {
            newItem.url = ""
        } else if (type === 'assignment') {
            newItem.instructions = ""
        } else if (type === 'exam') {
            newItem.duration = "60"
        }

        if (!newModules[mIdx].lessons) newModules[mIdx].lessons = []
        newModules[mIdx].lessons.push(newItem)
        setModules(newModules)
    }

    const removeItem = (mIdx: number, itemIdx: number) => {
        const newModules = [...modules]
        newModules[mIdx].lessons = newModules[mIdx].lessons.filter((_: any, i: number) => i !== itemIdx)
        setModules(newModules)
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container py-10 space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/instructor">
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">إدارة الكورس</h1>
                        <p className="text-muted-foreground">{course?.title}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={fetchCourse}>
                        إلغاء التعديلات
                    </Button>
                    <Button className="gap-2 px-8" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        حفظ التعديلات
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="content" className="gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        المحتوى والدروس
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        المعلومات الأساسية
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-6 pt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">هيكل الكورس</h2>
                        <Button onClick={addModule} className="gap-2">
                            <Plus className="h-4 w-4" />
                            إضافة وحدة جديدة
                        </Button>
                    </div>

                    <div className="space-y-6">
                        {modules.map((module, mIdx) => (
                            <Card key={module.id} className="border-2 border-muted">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-muted/30">
                                    <div className="flex-1 flex items-center gap-4">
                                        <span className="bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center font-bold">
                                            {mIdx + 1}
                                        </span>
                                        <Input
                                            value={module.title}
                                            onChange={(e) => {
                                                const newModules = [...modules]
                                                newModules[mIdx].title = e.target.value
                                                setModules(newModules)
                                            }}
                                            className="font-bold border-none bg-transparent focus-visible:ring-0 text-lg"
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                        setModules(modules.filter((_, i) => i !== mIdx))
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {module.lessons.map((item: any, iIdx: number) => (
                                        <div key={item.id} className="border rounded-xl p-4 bg-background shadow-sm space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                                                    {item.type === 'video' && <Video className="h-5 w-5" />}
                                                    {item.type === 'file' && <FileText className="h-5 w-5" />}
                                                    {item.type === 'assignment' && <ClipboardList className="h-5 w-5" />}
                                                    {item.type === 'exam' && <HelpCircle className="h-5 w-5" />}
                                                    {!item.type && <Video className="h-5 w-5" />} {/* Backward compat */}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <Input
                                                        value={item.title}
                                                        onChange={(e) => {
                                                            const newModules = [...modules]
                                                            newModules[mIdx].lessons[iIdx].title = e.target.value
                                                            setModules(newModules)
                                                        }}
                                                        placeholder="عنوان المحتوى"
                                                        className="font-medium border-none px-0 focus-visible:ring-0 h-auto text-base"
                                                    />
                                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider h-5">
                                                        {item.type === 'video' || !item.type ? "فيديو" :
                                                            item.type === 'file' ? "ملف / ملخص" :
                                                                item.type === 'assignment' ? "واجب" : "اختبار"}
                                                    </Badge>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeItem(mIdx, iIdx)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="mr-12 space-y-4">
                                                {(item.type === 'video' || !item.type) && (
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold">مسار الفيديو / الرابط (Youtube, Direct, etc...)</Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                value={item.video_path || ""}
                                                                onChange={(e) => {
                                                                    const newModules = [...modules]
                                                                    newModules[mIdx].lessons[iIdx].video_path = e.target.value
                                                                    setModules(newModules)
                                                                }}
                                                                placeholder="رابط الفيديو الخارجي أو المرفوع"
                                                                className="text-xs font-mono bg-muted/30 flex-1"
                                                            />
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button size="sm" className="gap-2 h-9 text-[10px]">
                                                                        <Upload className="h-3 w-3" />
                                                                        رفع فيديو
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>رفع فيديو للدرس</DialogTitle>
                                                                    </DialogHeader>
                                                                    <FileUploader
                                                                        label="اختر ملف الفيديو (MP4)"
                                                                        folder="videos"
                                                                        accept="video/*"
                                                                        onUploadComplete={(url) => {
                                                                            const newModules = [...modules]
                                                                            newModules[mIdx].lessons[iIdx].video_path = url
                                                                            setModules(newModules)
                                                                        }}
                                                                    />
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </div>
                                                )}
                                                {item.type === 'file' && (
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold">رابط الملف / التحميل</Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                value={item.url || ""}
                                                                onChange={(e) => {
                                                                    const newModules = [...modules]
                                                                    newModules[mIdx].lessons[iIdx].url = e.target.value
                                                                    setModules(newModules)
                                                                }}
                                                                placeholder="رابط الملف الخارجي أو المرفوع"
                                                                className="text-xs font-mono bg-muted/30 flex-1"
                                                            />
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button size="sm" className="gap-2 h-9 text-[10px]">
                                                                        <Upload className="h-3 w-3" />
                                                                        رفع ملف
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>رفع ملف تعليمي</DialogTitle>
                                                                    </DialogHeader>
                                                                    <FileUploader
                                                                        label="اختر الملف (PDF, Zip, etc...)"
                                                                        folder="files"
                                                                        accept=".pdf,.doc,.docx,.zip,.rar"
                                                                        onUploadComplete={(url) => {
                                                                            const newModules = [...modules]
                                                                            newModules[mIdx].lessons[iIdx].url = url
                                                                            setModules(newModules)
                                                                        }}
                                                                    />
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </div>
                                                )}
                                                {item.type === 'assignment' && (
                                                    <div className="space-y-4">
                                                        <Textarea
                                                            value={item.instructions || ""}
                                                            onChange={(e) => {
                                                                const newModules = [...modules]
                                                                newModules[mIdx].lessons[iIdx].instructions = e.target.value
                                                                setModules(newModules)
                                                            }}
                                                            placeholder="تعليمات أو وصف الواجب..."
                                                            className="text-xs min-h-[80px]"
                                                        />
                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] font-bold">عدد الأسئلة</Label>
                                                                <div className="h-8 flex items-center px-3 bg-muted/30 rounded-md text-xs font-bold">
                                                                    {item.questions?.length || 0} أسئلة
                                                                </div>
                                                            </div>
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="gap-2 h-9 border-primary/20 text-primary">
                                                                        <Plus className="h-3 w-3" />
                                                                        إدارة أسئلة الواجب
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                                                    <DialogHeader>
                                                                        <DialogTitle>منشئ الواجب - {item.title}</DialogTitle>
                                                                    </DialogHeader>
                                                                    <QuestionBuilder
                                                                        questions={item.questions || []}
                                                                        onChange={(qs) => {
                                                                            const newModules = [...modules]
                                                                            newModules[mIdx].lessons[iIdx].questions = qs
                                                                            setModules(newModules)
                                                                        }}
                                                                    />
                                                                    <DialogFooter>
                                                                        <Button onClick={() => {
                                                                            toast.success("تم تحديث أسئلة الواجب")
                                                                        }}>
                                                                            إغلاق وحفظ
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </div>
                                                )}
                                                {item.type === 'exam' && (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] font-bold">مدة الاختبار (بالدقائق)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={item.duration || "60"}
                                                                    onChange={(e) => {
                                                                        const newModules = [...modules]
                                                                        newModules[mIdx].lessons[iIdx].duration = e.target.value
                                                                        setModules(newModules)
                                                                    }}
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] font-bold">عدد الأسئلة</Label>
                                                                <div className="h-8 flex items-center px-3 bg-muted/30 rounded-md text-xs font-bold">
                                                                    {item.questions?.length || 0} أسئلة
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" className="w-full gap-2 text-xs h-10 border-primary/20 text-primary">
                                                                    <Plus className="h-3 w-3" />
                                                                    إدارة أسئلة الاختبار
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                                                <DialogHeader>
                                                                    <DialogTitle>منشئ الاختبار - {item.title}</DialogTitle>
                                                                </DialogHeader>
                                                                <QuestionBuilder
                                                                    questions={item.questions || []}
                                                                    onChange={(qs) => {
                                                                        const newModules = [...modules]
                                                                        newModules[mIdx].lessons[iIdx].questions = qs
                                                                        setModules(newModules)
                                                                    }}
                                                                />
                                                                <DialogFooter>
                                                                    <Button onClick={() => {
                                                                        toast.success("تم تحديث الأسئلة مؤقتاً، اضغط 'حفظ التعديلات' النهائي للتثبيت")
                                                                    }}>
                                                                        إغلاق وحفظ مؤقت
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t">
                                        <Button variant="outline" size="sm" className="gap-2 text-[11px]" onClick={() => addContent(mIdx, 'video')}>
                                            <Video className="h-3 w-3" /> فيديو
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-2 text-[11px]" onClick={() => addContent(mIdx, 'file')}>
                                            <FileText className="h-3 w-3" /> ملف / ملخص
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-2 text-[11px]" onClick={() => addContent(mIdx, 'assignment')}>
                                            <ClipboardList className="h-3 w-3" /> واجب منزلي
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-2 text-[11px]" onClick={() => addContent(mIdx, 'exam')}>
                                            <HelpCircle className="h-3 w-3" /> اختبار
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="pt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>تعديل بيانات الكورس</CardTitle>
                            <CardDescription>قم بتعديل الوصف أو السعر أو المادة.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>عنوان الكورس</Label>
                                <Input
                                    value={course?.title || ""}
                                    onChange={(e) => setCourse({ ...course, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>غلاف الكورس (Thumbnail)</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FileUploader
                                        label="رفع غلاف الكورس"
                                        folder="thumbnails"
                                        accept="image/*"
                                        onUploadComplete={(url) => {
                                            console.log("New thumbnail URL received:", url)
                                            setCourse({ ...course, thumbnail_url: url })
                                            toast.info("تم رفع الصورة، يرجى الضغط على 'حفظ التعديلات' لإتمام العملية")
                                        }}
                                    />
                                    {course?.thumbnail_url && (
                                        <div className="border rounded-xl aspect-video overflow-hidden bg-muted flex items-center justify-center relative group">
                                            <img src={course.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Badge className="bg-white text-black">معاينة</Badge>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>وصف الكورس</Label>
                                <Textarea
                                    value={course?.description || ""}
                                    onChange={(e) => setCourse({ ...course, description: e.target.value })}
                                    className="min-h-[150px]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>المادة الدراسية</Label>
                                    <Select
                                        value={course?.category}
                                        onValueChange={(val) => setCourse({ ...course, category: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر المادة" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="arabic">لغة عربية</SelectItem>
                                            <SelectItem value="math">رياضيات</SelectItem>
                                            <SelectItem value="english">لغة إنجليزية</SelectItem>
                                            <SelectItem value="science">علوم</SelectItem>
                                            <SelectItem value="physics">فيزياء</SelectItem>
                                            <SelectItem value="chemistry">كيمياء</SelectItem>
                                            <SelectItem value="other">كورسات تعليمية / أخرى</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>الصف الدراسي</Label>
                                    <Select
                                        value={course?.grade_level}
                                        onValueChange={(val) => setCourse({ ...course, grade_level: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الصف" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="primary_1">الأول الابتدائي</SelectItem>
                                            <SelectItem value="primary_2">الثاني الابتدائي</SelectItem>
                                            <SelectItem value="primary_3">الثالث الابتدائي</SelectItem>
                                            <SelectItem value="primary_4">الرابع الابتدائي</SelectItem>
                                            <SelectItem value="primary_5">الخامس الابتدائي</SelectItem>
                                            <SelectItem value="primary_6">السادس الابتدائي</SelectItem>
                                            <SelectItem value="prep_1">الأول الإعدادي</SelectItem>
                                            <SelectItem value="prep_2">الثاني الإعدادي</SelectItem>
                                            <SelectItem value="prep_3">الثالث الإعدادي</SelectItem>
                                            <SelectItem value="sec_1">الأول الثانوي</SelectItem>
                                            <SelectItem value="sec_2">الثاني الثانوي</SelectItem>
                                            <SelectItem value="sec_3">الثالث الثانوي</SelectItem>
                                            <SelectItem value="other">غير مرتبط بصف (كورس عام)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>السعر (ج.م)</Label>
                                    <Input
                                        type="number"
                                        value={course?.price || 0}
                                        onChange={(e) => setCourse({ ...course, price: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>الحالة</Label>
                                    <div className="flex items-center gap-2 pt-2 text-sm font-bold">
                                        {course?.status === 'approved' ? (
                                            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> منشور</span>
                                        ) : course?.status === 'rejected' ? (
                                            <span className="text-destructive flex items-center gap-1">تم الرفض</span>
                                        ) : (
                                            <span className="text-orange-600">بانتظار المراجعة</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

import { Label } from "@/components/ui/label"
