"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { auth, db } from "@/lib/firebase/config"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"

const loginSchema = z.object({
    email: z.string().email({ message: "البريد الإلكتروني غير صحيح" }),
    password: z.string().min(6, { message: "كلمة المرور يجب أن تكون ٦ أحرف على الأقل" }),
})

export function LoginForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setIsLoading(true)
        const email = values.email.trim().toLowerCase()
        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                values.password
            )

            console.log("LoginForm: Login successful for:", userCredential.user.uid)
            // Get ID token and set session cookie
            const idToken = await userCredential.user.getIdToken()
            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            })

            if (!sessionResponse.ok) {
                throw new Error("فشل إنشاء جلسة الدخول")
            }

            // Fetch user profile to determine role
            const profileRef = doc(db, "profiles", userCredential.user.uid)
            console.log("LoginForm: Fetching profile from Firestore...")
            const profileSnap = await getDoc(profileRef)

            if (!profileSnap.exists()) {
                console.warn("LoginForm: PROFILE MISSING in Firestore for UID:", userCredential.user.uid)
                toast.error("حدث خطأ: ملف المستخدم غير موجود في قاعدة البيانات")
                setIsLoading(false)
                return
            }

            const profile = profileSnap.data()
            console.log("LoginForm: Profile data:", profile);
            console.log("LoginForm: Profile retrieved, role:", profile?.role)

            // --- DEVICE LIMIT LOGIC ---
            // 1. Get or Generate Device ID
            let deviceId = localStorage.getItem('manara_device_id')
            if (!deviceId) {
                deviceId = crypto.randomUUID()
                localStorage.setItem('manara_device_id', deviceId)
            }

            const activeDevices = profile?.active_devices || []
            const isKnownDevice = activeDevices.includes(deviceId)

            if (!isKnownDevice) {
                if (activeDevices.length >= 2) {
                    console.warn("LoginForm: Max devices reached for UID:", userCredential.user.uid)
                    toast.error("عذراً، لقد وصلت للحد الأقصى للأجهزة (جهازين فقط). يرجى تسجيل الخروج من أجهزتك الأخرى أولاً.")
                    setIsLoading(false)
                    // Sign out from Firebase Auth since the device is blocked
                    await auth.signOut()
                    return
                }

                // Register this device
                const { arrayUnion, updateDoc } = await import("firebase/firestore")
                await updateDoc(profileRef, {
                    active_devices: arrayUnion(deviceId),
                    last_login: new Date().toISOString()
                })
                console.log("LoginForm: Device registered:", deviceId)
            } else {
                // Just update last login
                const { updateDoc } = await import("firebase/firestore")
                await updateDoc(profileRef, {
                    last_login: new Date().toISOString()
                })
            }
            // --- END DEVICE LIMIT LOGIC ---

            toast.success("تم تسجيل الدخول بنجاح")

            try {
                if (profile?.role === 'instructor') {
                    console.log("LoginForm: Navigating to /instructor")
                    await router.push("/instructor")
                } else {
                    console.log("LoginForm: Navigating to /dashboard")
                    await router.push("/dashboard")
                }
            } catch (navError) {
                console.error("LoginForm: Navigation failed, forcing reload:", navError)
                window.location.href = profile?.role === 'instructor' ? "/instructor" : "/dashboard"
            }
        } catch (error: any) {
            console.error("LoginForm: Root Error:", error)
            let message = "حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى."
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            } else if (error.code === 'auth/network-request-failed') {
                message = "لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة."
            } else if (error.code === 'auth/too-many-requests') {
                message = "محاولات كثيرة خاطئة، يرجى الانتظار قليلاً ثم المحاولة."
            }
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
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تسجيل الدخول
                </Button>
            </form>
        </Form>
    )
}
