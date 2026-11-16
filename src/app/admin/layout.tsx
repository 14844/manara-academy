"use client"

import { StatusGuard } from "@/components/auth/status-guard"
import { useState, useEffect, useMemo } from "react"
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
    Menu,
    Wallet,
    DollarSign,
    CheckCircle2,
    Ticket,
    Activity,
    BarChart3,
    Lock
} from "lucide-react"
import { DashboardSkeleton } from "@/components/skeletons"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { toast } from "sonner"
import {
    getRequiredPermissionForPath,
    getRoleLabel,
    hasPermission,
    isBackofficeRole,
    type UserRole,
} from "@/lib/permissions"
import { AdminRoleProvider } from "@/components/admin/admin-role-context"

const adminNavItems = [
    { name: "نظرة عامة", href: "/admin", icon: LayoutDashboard },
    { name: "المؤشرات والمالية (KPIs)", href: "/admin/kpis", icon: BarChart3 },
    { name: "سجل النشاطات (Logs)", href: "/admin/logs", icon: Activity },
    { name: "مراجعة الكورسات", href: "/admin/courses", icon: CheckSquare },
    { name: "المستخدمين", href: "/admin/users", icon: Users },
    { name: "جميع الكورسات", href: "/admin/all-courses", icon: BookOpen },
    { name: "مراجعة المدفوعات", href: "/admin/payments", icon: Wallet },
    { name: "تسويات المحاضرين", href: "/admin/settlements", icon: DollarSign },
    { name: "طلبات السحب", href: "/admin/withdrawals", icon: CheckCircle2 },
    { name: "إدارة الكوبونات", href: "/admin/coupons", icon: Ticket },
    { name: "الإعدادات", href: "/admin/settings", icon: Settings },
]

function canAccessPath(role: UserRole | null, path: string): boolean {
    const required = getRequiredPermissionForPath(path)
    return !required || hasPermission(role, required)
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isLoading, setIsLoading] = useState(true)
    const [role, setRole] = useState<UserRole | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login")
                return
            }

            // Verify backoffice role (admin or staff) in Firestore
            const docRef = doc(db, "profiles", user.uid)
            const docSnap = await getDoc(docRef)
            const userRole = docSnap.exists() ? docSnap.data().role : ''

            if (isBackofficeRole(userRole)) {
                setRole(userRole as UserRole)
            } else {
                toast.error("عذراً، لا تمتلك صلاحيات الوصول لهذه الصفحة")
                if (userRole === 'instructor') {
                    router.push("/instructor")
                } else {
                    router.push("/dashboard")
                }
            }
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [router])

    // Sidebar items this role may open
    const visibleNavItems = useMemo(
        () => adminNavItems.filter((item) => canAccessPath(role, item.href)),
        [role]
    )

    const currentPath = pathname || "/admin"
    const isPathAllowed = role ? canAccessPath(role, currentPath) : false
    const fallbackHref = visibleNavItems[0]?.href

    // Current page needs a permission this role lacks → send them to the first page they can open
    useEffect(() => {
        if (!role || isPathAllowed) return
        if (fallbackHref && fallbackHref !== currentPath) {
            router.replace(fallbackHref)
        }
    }, [role, isPathAllowed, fallbackHref, currentPath, router])

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col font-arabic">
                <Navbar />
                <DashboardSkeleton />
            </div>
        )
    }

    if (!role) return null

    const roleLabel = getRoleLabel(role)

    return (
        <AdminRoleProvider role={role}>
            <StatusGuard>
                <div className="flex min-h-screen flex-col font-arabic">
                    <Navbar />

                    {/* Mobile Header with Sidebar Toggle */}
                    <div className="md:hidden border-b bg-muted/20 px-4 py-3 flex items-center gap-4">
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
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
                                    <Badge variant="secondary" className="w-fit font-bold text-xs">
                                        {roleLabel}
                                    </Badge>
                                </SheetHeader>
                                <div className="flex flex-col gap-2 p-4">
                                    {visibleNavItems.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsSheetOpen(false)}
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
                        <Badge variant="secondary" className="mr-auto font-bold text-xs">
                            {roleLabel}
                        </Badge>
                    </div>

                    <div className="flex flex-1 container py-8 gap-8">
                        {/* Admin Sidebar */}
                        <aside className="w-64 shrink-0 hidden md:block">
                            <div className="flex flex-col gap-2 sticky top-24">
                                <div className="px-4 py-2 flex flex-col gap-1.5">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                        لوحة التحكم بالمنصة
                                    </span>
                                    <Badge variant="secondary" className="w-fit font-bold text-xs">
                                        {roleLabel}
                                    </Badge>
                                </div>
                                {visibleNavItems.map((item) => {
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
                            {isPathAllowed ? children : (
                                <Card className="border-dashed">
                                    <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                        <div className="p-3 rounded-full bg-muted">
                                            <Lock className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h2 className="text-xl font-bold">لا تملك صلاحية الوصول لهذه الصفحة</h2>
                                        <p className="text-sm text-muted-foreground max-w-sm">
                                            صلاحيات دورك الحالي ({roleLabel}) لا تشمل هذا القسم.
                                            {fallbackHref ? " جاري تحويلك إلى صفحة متاحة لك..." : ""}
                                        </p>
                                        {fallbackHref && (
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={fallbackHref}>الانتقال إلى صفحة متاحة</Link>
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </main>
                    </div>
                </div>
            </StatusGuard>
        </AdminRoleProvider>
    )
}
