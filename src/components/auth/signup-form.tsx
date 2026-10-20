"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { auth, db } from "@/lib/firebase/config"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import Link from "next/link"
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
import { toast } from "sonner"
import { logActivity } from "@/lib/activity-logger"
import { Loader2, Eye, EyeOff, ShieldAlert, ShieldCheck, Shield, GraduationCap, User } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

const ARAB_COUNTRIES = [
    { name: "مصر", code: "+20", flag: "🇪🇬" },
    { name: "السعودية", code: "+966", flag: "🇸🇦" },
    { name: "الإمارات", code: "+971", flag: "🇦🇪" },
    { name: "الكويت", code: "+965", flag: "🇰🇼" },
    { name: "قطر", code: "+974", flag: "🇶🇦" },
    { name: "البحرين", code: "+973", flag: "🇧🇭" },
    { name: "عمان", code: "+968", flag: "🇴🇲" },
    { name: "الأردن", code: "+962", flag: "🇯🇴" },
    { name: "لبنان", code: "+961", flag: "🇱🇧" },
    { name: "فلسطين", code: "+970", flag: "🇵🇸" },
    { name: "العراق", code: "+964", flag: "🇮🇶" },
    { name: "المغرب", code: "+212", flag: "🇲🇦" },
    { name: "تونس", code: "+216", flag: "🇹🇳" },
    { name: "الجزائر", code: "+213", flag: "🇩🇿" },
    { name: "ليبيا", code: "+218", flag: "🇱🇾" },
    { name: "السودان", code: "+249", flag: "🇸🇩" },
    { name: "اليمن", code: "+967", flag: "🇾🇪" },
]

const signupSchema = z.object({
    fullName: z.string().min(3, { message: "الاسم يجب أن يكون ٣ أحرف على الأقل" }),
    email: z.string().email({ message: "البريد الإلكتروني غير صحيح" }).endsWith("@gmail.com", { message: "يجب استخدام بريد Gmail فقط (تنتهي بـ @gmail.com)" }),
    password: z.string().min(6, { message: "كلمة المرور يجب أن تكون ٦ أحرف على الأقل" }),
    phone: z.string().min(8, { message: "رقم الهاتف غير صحيح" }),
    countryCode: z.string(),
    role: z.enum(["student", "instructor"]),
    gradeLevel: z.string().optional(),
    parentPhone: z.string().optional(),
    specialty: z.string().optional(),
    bio: z.string().optional(),
    acceptPolicies: z.boolean().refine(val => val === true, {
        message: "يجب الموافقة على الشروط والأحكام وسياسة الخصوصية للمتابعة",
    }),
}).superRefine((data, ctx) => {
    // ... rest of refine logic ...
    const cleanPhone = (str: string) => {
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return (str || "").replace(/[٠-٩]/g, w => arabicNumbers.indexOf(w).toString()).replace(/\D/g, "");
    };

    let cleanedUserPhone = cleanPhone(data.phone);

    if (data.countryCode === "+20") {
        if (cleanedUserPhone.length === 10 && cleanedUserPhone.startsWith("1")) {
            cleanedUserPhone = "0" + cleanedUserPhone;
        }
        if (cleanedUserPhone.length !== 11) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "رقم الهاتف غير صحيح",
                path: ["phone"]
            });
        }
    } else {
        if (cleanedUserPhone.length < 8) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "رقم الهاتف غير صحيح",
                path: ["phone"]
            });
        }
    }

    if (data.role === "student") {
        if (!data.gradeLevel) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "يرجى اختيار المرحلة الدراسية",
                path: ["gradeLevel"]
            });
        }
        
        let cleanedParentPhone = cleanPhone(data.parentPhone || "");
        if (data.countryCode === "+20" && cleanedParentPhone.length === 10 && cleanedParentPhone.startsWith("1")) {
            cleanedParentPhone = "0" + cleanedParentPhone;
        }
        if (cleanedParentPhone.length < 10) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "رقم هاتف ولي الأمر غير صحيح",
                path: ["parentPhone"]
            });
        }
    }

    if (data.role === "instructor") {
        if (!data.specialty) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "يرجى إدخال التخصص",
                path: ["specialty"]
            });
        }
        if (!data.bio) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "يرجى إدخال نبذة عنك",
                path: ["bio"]
            });
        }
    }
})

export function SignupForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    
    // ... helper functions ...
    const calculateStrength = (password: string) => {
        let strength = 0;
        if (!password) return 0;
        if (password.length >= 8) strength += 20;
        if (/[A-Z]/.test(password)) strength += 20;
        if (/[a-z]/.test(password)) strength += 20;
        if (/[0-9]/.test(password)) strength += 20;
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        return strength;
    };

    const getStrengthLabels = (strength: number) => {
        if (strength === 0) return { label: "أدخل كلمة المرور", color: "bg-muted" };
        if (strength <= 20) return { label: "ضعيفة جداً - أضف أرقاماً ورموزاً", color: "bg-red-500" };
        if (strength <= 40) return { label: "ضعيفة - استخدم أحرفاً كبيرة وصغيرة", color: "bg-orange-500" };
        if (strength <= 60) return { label: "متوسطة - اجعلها أطول قليلاً", color: "bg-yellow-500" };
        if (strength <= 80) return { label: "جيدة - أضف رمزاً خاصاً (#@!)", color: "bg-blue-500" };
        return { label: "قوية جداً ومؤمنة تماماً ✅", color: "bg-green-500" };
    };

    const form = useForm<z.infer<typeof signupSchema>>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            fullName: "",
            email: "",
            password: "",
            phone: "",
            countryCode: "+20",
            role: "student",
            gradeLevel: "",
            parentPhone: "",
            specialty: "",
            bio: "",
            acceptPolicies: false,
        },
    })

    async function onSubmit(values: z.infer<typeof signupSchema>) {
        setIsLoading(true)
        const email = values.email.trim().toLowerCase()

        // Get or Generate Device ID for new registration
        let deviceId = localStorage.getItem('manara_device_id')
        if (!deviceId) {
            deviceId = crypto.randomUUID()
            localStorage.setItem('manara_device_id', deviceId)
        }

        // Sanitize phone numbers ...
        const cleanPhone = (str: string) => {
            const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            return (str || "").replace(/[٠-٩]/g, w => arabicNumbers.indexOf(w).toString()).replace(/\D/g, "");
        };

        let cleanedUserPhone = cleanPhone(values.phone);
        if (values.countryCode === "+20" && cleanedUserPhone.length === 10 && cleanedUserPhone.startsWith("1")) {
            cleanedUserPhone = "0" + cleanedUserPhone;
        }
        const fullPhone = values.countryCode + cleanedUserPhone;

        const cleanedParentPhone = values.role === 'student' ? cleanPhone(values.parentPhone || "") : null;
        const formattedParentPhone = cleanedParentPhone ? values.countryCode + cleanedParentPhone : null;

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                values.password
            )
            const user = userCredential.user

            await updateProfile(user, {
                displayName: values.fullName
            })

            const idToken = await user.getIdToken()

            const registerRes = await fetch("/api/auth/register-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    idToken,
                    fullName: values.fullName,
                    role: values.role,
                    phone: fullPhone,
                    parentPhone: formattedParentPhone,
                    gradeLevel: values.gradeLevel || null,
                    specialty: values.specialty || null,
                    bio: values.bio || null,
                    deviceId,
                }),
            })

            const regData = await registerRes.json().catch(() => ({}))
            if (!registerRes.ok) {
                await user.delete().catch(() => {})
                throw new Error(regData.error || "فشل تسجيل بيانات الحساب")
            }
            const studentId = regData.studentId || "N/A"

            // 5. Set session cookie
            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, deviceId })
            })

            if (!sessionResponse.ok) {
                throw new Error("فشل إنشاء جلسة الدخول")
            }

            toast.success("تم إنشاء الحساب بنجاح! حسابك قيد المراجعة حالياً.")

            // Log activity
            logActivity({
                action: "user_signup",
                category: "auth",
                title: "إنشاء حساب جديد",
                description: `قام ${values.role === "instructor" ? "مدرس جديد" : "طالب جديد"} بإنشاء حساب باسم "${values.fullName}" (${email})`,
                status: "success",
                user_id: user.uid,
                user_name: values.fullName,
                user_email: email,
                user_role: values.role as any,
                metadata: {
                    role: values.role,
                    phone: fullPhone,
                    student_id: studentId,
                }
            }).catch(() => {})

            // 5. Redirect to pending approval page
            router.push("/pending-approval")
        } catch (error: any) {
            console.error("Signup error:", error)
            let message = "حدث خطأ في إنشاء الحساب، يرجى المحاولة مرة أخرى."
            if (error.code === 'auth/email-already-in-use') message = "البريد الإلكتروني مستخدم بالفعل."
            else if (error.code === 'auth/weak-password') message = "كلمة المرور ضعيفة جداً."
            else if (error.code === 'auth/network-request-failed') message = "لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة."

            logActivity({
                action: "user_signup_failed",
                category: "auth",
                title: "فشل إنشاء حساب",
                description: `فشلت محاولة تسجيل حساب جديد (${values.email}): ${message}`,
                status: "failed",
                user_name: values.fullName || "مستخدم جديد",
                user_email: values.email,
                user_role: values.role as any,
                error_message: error.message || message,
            }).catch(() => {})

            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    {/* Full Name */}
                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                                <FormLabel className="text-xs font-bold">الاسم الكامل</FormLabel>
                                <FormControl>
                                    <Input placeholder="أحمد محمد" {...field} className="h-10 rounded-xl" />
                                </FormControl>
                                <FormMessage className="text-[11px]" />
                            </FormItem>
                        )}
                    />

                    {/* Email */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                                <FormLabel className="text-xs font-bold">البريد الإلكتروني (Gmail فقط)</FormLabel>
                                <FormControl>
                                    <Input placeholder="example@gmail.com" {...field} dir="ltr" className="h-10 rounded-xl font-mono text-sm" />
                                </FormControl>
                                <FormMessage className="text-[11px]" />
                            </FormItem>
                        )}
                    />

                    {/* Password */}
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                                <FormLabel className="text-xs font-bold">كلمة المرور</FormLabel>
                                <FormControl>
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <Input 
                                                type={showPassword ? "text" : "password"} 
                                                placeholder="••••••••" 
                                                {...field} 
                                                dir="ltr" 
                                                className="pr-10 h-10 rounded-xl"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {/* Compact Strength Indicator */}
                                        <div className="space-y-1 pt-0.5">
                                            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-300 ${getStrengthLabels(calculateStrength(field.value)).color}`}
                                                    style={{ width: `${calculateStrength(field.value)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-muted-foreground text-[10px]">قوة كلمة المرور:</span>
                                                <span className={calculateStrength(field.value) > 40 ? "text-primary text-[10px]" : "text-muted-foreground text-[10px]"}>
                                                    {getStrengthLabels(calculateStrength(field.value)).label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[11px]" />
                            </FormItem>
                        )}
                    />

                    {/* Phone + Country Code */}
                    <div className="space-y-1">
                        <FormLabel className="text-xs font-bold">رقم الهاتف</FormLabel>
                        <div className="grid grid-cols-[105px_1fr] gap-1.5" dir="ltr">
                            <FormField
                                control={form.control}
                                name="countryCode"
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-10 text-xs px-2 rounded-xl" dir="ltr">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ARAB_COUNTRIES.map((c) => (
                                                    <SelectItem key={c.code} value={c.code}>
                                                        <span className="flex items-center gap-1.5 text-xs">
                                                            <span>{c.flag}</span>
                                                            <span className="font-mono">{c.code}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <Input 
                                                placeholder="10xxxxxxxx" 
                                                {...field} 
                                                dir="ltr" 
                                                className="h-10 rounded-xl font-mono text-sm"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        {form.formState.errors.phone && (
                            <p className="text-[11px] font-medium text-destructive mt-0.5">
                                {form.formState.errors.phone.message}
                            </p>
                        )}
                    </div>

                    {/* Role Selection (Toggle Cards) */}
                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem className="space-y-1.5 sm:col-span-2">
                                <FormLabel className="text-xs font-bold text-muted-foreground">نوع الحساب</FormLabel>
                                <FormControl>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => field.onChange("student")}
                                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-bold transition-all ${
                                                field.value === "student"
                                                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40"
                                                    : "border-border/70 hover:border-primary/50 text-muted-foreground hover:bg-muted/40"
                                            }`}
                                        >
                                            <GraduationCap className="h-4 w-4" />
                                            <span>طالب</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => field.onChange("instructor")}
                                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-bold transition-all ${
                                                field.value === "instructor"
                                                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40"
                                                    : "border-border/70 hover:border-primary/50 text-muted-foreground hover:bg-muted/40"
                                            }`}
                                        >
                                            <User className="h-4 w-4" />
                                            <span>مدرس</span>
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[11px]" />
                            </FormItem>
                        )}
                    />

                    {/* Student Dynamic Fields */}
                    {form.watch("role") === "student" && (
                        <>
                            <FormField
                                control={form.control}
                                name="gradeLevel"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel className="text-xs font-bold">المرحلة الدراسية</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                                    <SelectValue placeholder="اختر مرحلتك الدراسية" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="primary_4">الصف الرابع الابتدائي</SelectItem>
                                                <SelectItem value="primary_5">الصف الخامس الابتدائي</SelectItem>
                                                <SelectItem value="primary_6">الصف السادس الابتدائي</SelectItem>
                                                <SelectItem value="prep_1">الصف الأول الإعدادي</SelectItem>
                                                <SelectItem value="prep_2">الصف الثاني الإعدادي</SelectItem>
                                                <SelectItem value="prep_3">الصف الثالث الإعدادي</SelectItem>
                                                <SelectItem value="sec_1">الصف الأول الثانوي</SelectItem>
                                                <SelectItem value="sec_2">الصف الثاني الثانوي</SelectItem>
                                                <SelectItem value="sec_3">الصف الثالث الثانوي</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[11px]" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="parentPhone"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <FormLabel className="text-xs font-bold">رقم هاتف ولي الأمر</FormLabel>
                                            <span className="text-[10px] text-muted-foreground">للتواصل عند الضرورة</span>
                                        </div>
                                        <FormControl>
                                            <Input placeholder="01xxxxxxxxx" {...field} dir="ltr" className="h-10 rounded-xl font-mono text-sm" />
                                        </FormControl>
                                        <FormMessage className="text-[11px]" />
                                    </FormItem>
                                )}
                            />
                        </>
                    )}

                    {/* Instructor Dynamic Fields */}
                    {form.watch("role") === "instructor" && (
                        <>
                            <FormField
                                control={form.control}
                                name="specialty"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel className="text-xs font-bold">التخصص</FormLabel>
                                        <FormControl>
                                            <Input placeholder="مثلاً: لغة عربية، رياضيات..." {...field} className="h-10 rounded-xl" />
                                        </FormControl>
                                        <FormMessage className="text-[11px]" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bio"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel className="text-xs font-bold">نبذة عنك / الخبرة</FormLabel>
                                        <FormControl>
                                            <Input placeholder="أخبرنا قليلاً عن خبرتك التعليمية..." {...field} className="h-10 rounded-xl" />
                                        </FormControl>
                                        <FormMessage className="text-[11px]" />
                                    </FormItem>
                                )}
                            />
                        </>
                    )}

                    {/* Terms & Policies */}
                    <FormField
                        control={form.control}
                        name="acceptPolicies"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-2 flex flex-row items-center space-x-2.5 space-x-reverse rounded-xl border p-3 bg-muted/20">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel className="text-xs font-medium cursor-pointer">
                                        أوافق على <Link href="/terms" className="text-primary font-bold hover:underline">شروط الاستخدام</Link> و <Link href="/privacy" className="text-primary font-bold hover:underline">سياسة الخصوصية</Link>
                                    </FormLabel>
                                    <FormMessage className="text-[11px]" />
                                </div>
                            </FormItem>
                        )}
                    />

                    {/* Submit Button */}
                    <div className="sm:col-span-2 pt-1">
                        <Button type="submit" className="w-full h-11 text-base font-bold rounded-xl shadow-md hover:shadow-lg transition-all" disabled={isLoading}>
                            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            إنشاء حساب
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    )
}
