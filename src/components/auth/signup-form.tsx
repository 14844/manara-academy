"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { auth, db } from "@/lib/firebase/config"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore"
import { generateUniqueStudentId } from "@/lib/profile-utils"
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
import { toast } from "sonner"
import { Loader2, Eye, EyeOff, ShieldAlert, ShieldCheck, Shield } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"

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
}).superRefine((data, ctx) => {
    // Helper to clean phone numbers (handles Arabic numerals and spaces)
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
    
    // Password strength logic: 20 points each for:
    // 1. Length >= 8
    // 2. Has Uppercase
    // 3. Has Lowercase
    // 4. Has Number
    // 5. Has Special Character
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
        },
    })

    async function onSubmit(values: z.infer<typeof signupSchema>) {
        setIsLoading(true)
        const email = values.email.trim().toLowerCase()

        // Sanitize phone numbers to handle spaces, Arabic numerals, and missing leading zeros
        const cleanPhone = (str: string) => {
            const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            return (str || "").replace(/[٠-٩]/g, w => arabicNumbers.indexOf(w).toString()).replace(/\D/g, "");
        };

        let cleanedUserPhone = cleanPhone(values.phone);
        // Normalize Egypt phone to start with 01 if they entered 10 digits
        if (values.countryCode === "+20" && cleanedUserPhone.length === 10 && cleanedUserPhone.startsWith("1")) {
            cleanedUserPhone = "0" + cleanedUserPhone;
        }
        const fullPhone = values.countryCode + cleanedUserPhone;

        const cleanedParentPhone = values.role === 'student' ? cleanPhone(values.parentPhone || "") : null;
        const formattedParentPhone = cleanedParentPhone ? values.countryCode + cleanedParentPhone : null;

        try {
            // Check for existing email or phone in Firestore first
            const profilesRef = collection(db, "profiles")

            const qEmail = query(profilesRef, where("email", "==", email))
            const qPhone = query(profilesRef, where("phone", "==", fullPhone))

            const [emailSnap, phoneSnap] = await Promise.all([
                getDocs(qEmail),
                getDocs(qPhone)
            ])

            if (!emailSnap.empty) {
                toast.error("هذا البريد الإلكتروني مسجل بالفعل")
                setIsLoading(false)
                return
            }

            if (!phoneSnap.empty) {
                toast.error("رقم الهاتف هذا مسجل بالفعل")
                setIsLoading(false)
                return
            }

            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                values.password
            )
            const user = userCredential.user

            // 2. Update Display Name
            await updateProfile(user, {
                displayName: values.fullName
            })

            // 3. Generate Unique Student ID
            const studentId = await generateUniqueStudentId()

            // 4. Create User Profile in Firestore
            await setDoc(doc(db, "profiles", user.uid), {
                id: user.uid,
                student_id: studentId,
                email: email,
                full_name: values.fullName,
                role: values.role,
                phone: fullPhone,
                parent_phone: formattedParentPhone,
                grade_level: values.gradeLevel || null,
                specialty: values.specialty || null,
                bio: values.bio || null,
                status: "pending",
                wallet_balance: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })

            // 5. Set session cookie
            const idToken = await user.getIdToken()
            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            })

            if (!sessionResponse.ok) {
                throw new Error("فشل إنشاء جلسة الدخول")
            }

            toast.success("تم إنشاء الحساب بنجاح! حسابك قيد المراجعة حالياً.")

            // 5. Redirect to pending approval page
            router.push("/pending-approval")
        } catch (error: any) {
            console.error("Signup error:", error)
            let message = "حدث خطأ في إنشاء الحساب، يرجى المحاولة مرة أخرى."
            if (error.code === 'auth/email-already-in-use') message = "البريد الإلكتروني مستخدم بالفعل."
            else if (error.code === 'auth/weak-password') message = "كلمة المرور ضعيفة جداً."
            else if (error.code === 'auth/network-request-failed') message = "لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة."

            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>الاسم الكامل</FormLabel>
                            <FormControl>
                                <Input placeholder="أحمد محمد" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>البريد الإلكتروني</FormLabel>
                            <FormControl>
                                <Input placeholder="example@mail.com" {...field} dir="ltr" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>كلمة المرور</FormLabel>
                            <FormControl>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="••••••••" 
                                            {...field} 
                                            dir="ltr" 
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {/* Strength Indicator */}
                                    <div className="space-y-1.5">
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-300 ${getStrengthLabels(calculateStrength(field.value)).color}`}
                                                style={{ width: `${calculateStrength(field.value)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="text-muted-foreground">قوة كلمة المرور:</span>
                                            <span className={calculateStrength(field.value) > 40 ? "text-primary" : "text-muted-foreground"}>
                                                {getStrengthLabels(calculateStrength(field.value)).label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-4 gap-2">
                    <FormField
                        control={form.control}
                        name="countryCode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>الكود</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger dir="ltr">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {ARAB_COUNTRIES.map((c) => (
                                            <SelectItem key={c.code} value={c.code}>
                                                <span className="flex items-center gap-2">
                                                    <span>{c.flag}</span>
                                                    <span>{c.code}</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem className="col-span-3">
                                <FormLabel>رقم الهاتف</FormLabel>
                                <FormControl>
                                    <Input placeholder="10xxxxxxxx" {...field} dir="ltr" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>نوع الحساب</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex flex-row space-x-4 space-x-reverse"
                                >
                                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                                        <FormControl>
                                            <RadioGroupItem value="student" />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer">
                                            طالب
                                        </FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                                        <FormControl>
                                            <RadioGroupItem value="instructor" />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer">
                                            مدرس
                                        </FormLabel>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {form.watch("role") === "student" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <FormField
                            control={form.control}
                            name="gradeLevel"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>المرحلة الدراسية</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
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
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parentPhone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>رقم هاتف ولي الأمر</FormLabel>
                                    <FormControl>
                                        <Input placeholder="01xxxxxxxxx" {...field} dir="ltr" />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">مطلوب للتواصل عند الضرورة</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                {form.watch("role") === "instructor" && (
                    <>
                        <FormField
                            control={form.control}
                            name="specialty"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>التخصص</FormLabel>
                                    <FormControl>
                                        <Input placeholder="مثلاً: لغة عربية، رياضيات..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bio"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>نبذة عنك / الخبرة</FormLabel>
                                    <FormControl>
                                        <Input placeholder="أخبرنا قليلاً عن خبرتك التعليمية..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    إنشاء حساب
                </Button>
            </form>
        </Form>
    )
}
