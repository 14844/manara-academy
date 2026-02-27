"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { auth, db } from "@/lib/firebase/config"
import { collection, doc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Circle, ArrowLeft, ArrowRight, Plus, Trash2, Video } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { FileUploader } from "@/components/file-uploader"
import { Label } from "@/components/ui/label"

const courseSchema = z.object({
    title: z.string().min(5, "العنوان يجب أن يكون ٥ أحرف على الأقل"),
    description: z.string().min(20, "الوصف يجب أن يكون ٢٠ حرفاً على الأقل"),
    category: z.string().min(1, "يرجى اختيار المادة"),
    gradeLevel: z.string().min(1, "يرجى اختيار الصف الدراسي"),
    price: z.string().min(1, "يرجى تحديد السعر"),
    duration: z.string().min(1, "يرجى تحديد المدة"),
    thumbnail_url: z.string().optional(),
})

export default function NewCoursePage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [modules, setModules] = useState([{ id: 1, title: "", lessons: [{ id: 1, title: "" }] }])

    const form = useForm<z.infer<typeof courseSchema>>({
        resolver: zodResolver(courseSchema),
        defaultValues: {
            title: "",
            description: "",
            category: "",
            gradeLevel: "",
            price: "",
            duration: "",
            thumbnail_url: "",
        },
    })

    const addModule = () => {
        setModules([...modules, { id: Date.now(), title: "", lessons: [{ id: Date.now() + 1, title: "" }] }])
    }

    const addLesson = (moduleId: number) => {
        setModules(modules.map(m =>
            m.id === moduleId ? { ...m, lessons: [...m.lessons, { id: Date.now(), title: "" }] } : m
        ))
    }

    const removeModule = (id: number) => {
        if (modules.length > 1) setModules(modules.filter(m => m.id !== id))
    }

    async function onSubmit(values: z.infer<typeof courseSchema>) {
        if (!auth.currentUser) {
            toast.error("يجب تسجيل الدخول أولاً")
            return
        }

        setIsLoading(true)
        try {
            const courseRef = doc(collection(db, "courses"))
            await setDoc(courseRef, {
                id: courseRef.id,
                instructor_id: auth.currentUser.uid,
                instructor_name: auth.currentUser.displayName || "مدرس غير معروف",
                title: values.title,
                description: values.description,
                category: values.category,
                grade_level: values.gradeLevel,
                price: parseFloat(values.price),
                duration: parseFloat(values.duration),
                thumbnail_url: form.getValues("thumbnail_url" as any) || "",
                status: "pending", // Courses need admin approval
                modules: modules, // Dynamic modules/lessons from state
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })

            toast.success("تم إنشاء الكورس بنجاح وهو بانتظار مراجعة الإدارة")
            router.push("/instructor")
        } catch (error: any) {
            console.error("Course creation error:", error)
            toast.error("حدث خطأ أثناء إنشاء الكورس")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Stepper */}
            <div className="flex items-center justify-between px-10">
                <StepIndicator current={step} target={1} label="المعلومات الأساسية" />
                <div className="flex-1 h-px bg-muted mx-4" />
                <StepIndicator current={step} target={2} label="المحتوى والدروس" />
                <div className="flex-1 h-px bg-muted mx-4" />
                <StepIndicator current={step} target={3} label="المراجعة والنشر" />
            </div>

            <Card>
                <CardContent className="pt-6">
                    {step === 1 && (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(() => setStep(2))} className="space-y-6">
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>عنوان الكورس</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="مثلاً: أساسيات البرمجة ببايثون" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>وصف الكورس</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="اشرح للطلاب ماذا سيتعلمون في هذا الكورس..." className="min-h-[120px]" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>المادة الدراسية</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="اختر المادة" />
                                                            </SelectTrigger>
                                                        </FormControl>
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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="gradeLevel"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الصف الدراسي</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="اختر الصف" />
                                                            </SelectTrigger>
                                                        </FormControl>
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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>السعر (ج.م)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="500" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="duration"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>المدة (بالساعات)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.5" placeholder="10" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="space-y-2">
                                            <Label>غلاف الكورس (Thumbnail)</Label>
                                            <div className="flex items-center gap-4 border p-4 rounded-lg bg-muted/5">
                                                {form.watch("thumbnail_url") ? (
                                                    <div className="relative w-32 aspect-video rounded-lg overflow-hidden border">
                                                        <img
                                                            src={form.watch("thumbnail_url")}
                                                            alt="Thumbnail"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-6 w-6"
                                                            onClick={() => form.setValue("thumbnail_url", "")}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1">
                                                        <FileUploader
                                                            label="رفع غلاف الكورس"
                                                            folder="thumbnails"
                                                            accept="image/*"
                                                            onUploadComplete={(url: string) => form.setValue("thumbnail_url", url)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="submit">
                                        المتابعة للمحتوى
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold">بناء هيكل الكورس</h3>
                                    <Button variant="outline" size="sm" onClick={addModule}>
                                        <Plus className="ml-2 h-4 w-4" />
                                        إضافة وحدة جديدة
                                    </Button>
                                </div>

                                {modules.map((module, mIdx) => (
                                    <div key={module.id} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                                        <div className="flex items-center gap-4">
                                            <span className="bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center text-xs">
                                                {mIdx + 1}
                                            </span>
                                            <Input
                                                placeholder="عنوان الوحدة (مثلاً: المقدمة)"
                                                className="bg-background"
                                                value={module.title}
                                                onChange={(e) => {
                                                    const newModules = [...modules]
                                                    newModules[mIdx].title = e.target.value
                                                    setModules(newModules)
                                                }}
                                            />
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeModule(module.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="mr-10 space-y-3">
                                            {module.lessons.map((lesson, lIdx) => (
                                                <div key={lesson.id} className="flex items-center gap-3">
                                                    <Video className="h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder={`اسم الدرس ${lIdx + 1}`}
                                                        size={30}
                                                        className="bg-background h-8 text-sm"
                                                        value={lesson.title}
                                                        onChange={(e) => {
                                                            const newModules = [...modules]
                                                            newModules[mIdx].lessons[lIdx].title = e.target.value
                                                            setModules(newModules)
                                                        }}
                                                    />
                                                    {lIdx === module.lessons.length - 1 && (
                                                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => addLesson(module.id)}>
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-6 border-t">
                                <Button variant="outline" onClick={() => setStep(1)}>
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                    العودة
                                </Button>
                                <Button onClick={form.handleSubmit(onSubmit)}>
                                    مراجعة الكورس
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center py-10 space-y-6">
                            <div className="flex justify-center">
                                <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-green-600">الكورس جاهز للمراجعة!</h3>
                                <p className="text-muted-foreground">تم حفظ بيانات الكورس وإرسالها للإدارة للموافقة عليها.</p>
                            </div>
                            <Button asChild>
                                <Link href="/instructor/courses">العودة لكورساتي</Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function StepIndicator({ current, target, label }: { current: number, target: number, label: string }) {
    const isDone = current > target
    const isActive = current === target

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${isDone ? "bg-primary border-primary text-primary-foreground" :
                isActive ? "border-primary text-primary" : "border-muted text-muted-foreground"
                }`}>
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : target}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${isActive || isDone ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
            </span>
        </div>
    )
}
