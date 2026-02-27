"use client"

import { StatusGuard } from "@/components/auth/status-guard"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Navbar } from "@/components/navbar"
import {
    LayoutDashboard,
    BookOpen,
    Users,
    CheckSquare,
    Settings,
    ShieldAlert,
    Loader2,
    Menu,
    Wallet,
    DollarSign,
    CheckCircle2
} from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const adminNavItems = [
    { name: "نظرة عامة", href: "/admin", icon: LayoutDashboard },
    { name: "مراجعة الكورسات", href: "/admin/courses", icon: CheckSquare },
    { name: "المستخدمين", href: "/admin/users", icon: Users },
    { name: "جميع الكورسات", href: "/admin/all-courses", icon: BookOpen },
    { name: "مراجعة المدفوعات", href: "/admin/payments", icon: Wallet },
    { name: "تسويات المحاضرين", href: "/admin/settlements", icon: DollarSign },
    { name: "طلبات السحب", href: "/admin/withdrawals", icon: CheckCircle2 },
    { name: "الإعدادات", href: "/admin/settings", icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isLoading, setIsLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login")
                return
            }

            // Verify admin role in Firestore
            const docRef = doc(db, "profiles", user.uid)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists() && docSnap.data().role === 'admin') {
                setIsAdmin(true)
            } else {
                toast.error("عذراً، لا تمتلك صلاحيات الوصول لهذه الصفحة")
                router.push("/dashboard")
            }
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [router])

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground italic font-arabic">جاري التحقق من الصلاحيات...</p>
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <StatusGuard>
            <div className="flex min-h-screen flex-col font-arabic">
                <Navbar />

                {/* Mobile Header with Sidebar Toggle */}
                <div className="md:hidden border-b bg-muted/20 px-4 py-3 flex items-center gap-4">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-64 p-0">
                            <SheetHeader className="p-6 border-b text-right">
                                <SheetTitle className="flex items-center gap-2 font-bold text-xl">
                                    <ShieldAlert className="h-6 w-6 text-primary" />
                                    <span>لوحة تحكم المسؤول</span>
                                </SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-2 p-4">
                                {adminNavItems.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${pathname === item.href
                                                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                                : "hover:bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            <Icon className="h-5 w-5" />
                                            <span>{item.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </SheetContent>
                    </Sheet>
                    <span className="font-bold text-primary">لوحة التحكم بالمنصة</span>
                </div>

                <div className="flex flex-1 container py-8 gap-8">
                    {/* Admin Sidebar */}
                    <aside className="w-64 shrink-0 hidden md:block">
                        <div className="flex flex-col gap-2 sticky top-24">
                            <div className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                لوحة التحكم بالمنصة
                            </div>
                            {adminNavItems.map((item) => {
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${pathname === item.href
                                            ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                            : "hover:bg-muted text-muted-foreground"
                                            }`}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span>{item.name}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </StatusGuard>
    )
}

import { toast } from "sonner"
