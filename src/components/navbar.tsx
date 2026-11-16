"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Menu, X, GraduationCap, LayoutDashboard, LogOut, Wallet, ShieldCheck } from "lucide-react"
import { getHomeRouteForRole, getRoleLabel, isBackofficeRole } from "@/lib/permissions"

const navItems = [
    { name: "الرئيسية", href: "/" },
    { name: "الكورسات", href: "/courses" },
    { name: "المختبرات", href: "/labs" },
    { name: "للمدرسين", href: "/teach" },
    { name: "المساعدة", href: "/help" },
]

function isActive(pathname: string | null, href: string) {
    if (!pathname) return false
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
}

export function Navbar() {
    const pathname = usePathname()
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                try {
                    const res = await fetch("/api/profile/me");
                    if (res.ok) {
                        const data = await res.json();
                        setProfile(data);
                    } else {
                        const docRef = doc(db, "profiles", currentUser.uid);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            setProfile(docSnap.data());
                        }
                    }
                } catch {
                    try {
                        const docRef = doc(db, "profiles", currentUser.uid);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            setProfile(docSnap.data());
                        }
                    } catch {
                        // profile unavailable — navbar still works with defaults
                    }
                }
            } else {
                setProfile(null)
            }
        })
        return () => unsubscribe()
    }, [])

    const handleLogout = async () => {
        await signOut(auth)
        await fetch('/api/auth/session', { method: 'DELETE' })
        window.location.href = '/'
    }

    const role = profile?.role
    const isBackoffice = isBackofficeRole(role)
    // Backoffice (admin + staff) home is /admin; instructors → /instructor; students → /dashboard
    const dashboardHref = getHomeRouteForRole(role)
    const dashboardLabel = isBackoffice ? "لوحة الإدارة" : "لوحة التحكم"
    const roleLabel = profile ? getRoleLabel(role) : null

    return (
        <header className="sticky top-2 sm:top-4 z-50 w-[calc(100%-1rem)] sm:w-[95%] mx-auto glass rounded-2xl sm:rounded-3xl border border-white/20 shadow-lg">
            <div className="container flex h-16 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4 xl:gap-8">
                    <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-primary shrink-0" />
                        {/* Full name where there is room; short name on phones and at lg (where the nav needs space) */}
                        <span className="hidden sm:inline-block lg:hidden xl:inline-block font-bold text-xl whitespace-nowrap">أكاديمية المنارة</span>
                        <span className="sm:hidden lg:inline-block xl:hidden font-bold text-lg whitespace-nowrap">المنارة</span>
                    </Link>
                    <nav className="hidden lg:flex items-center gap-1" aria-label="التنقل الرئيسي">
                        {navItems.map((item) => {
                            const active = isActive(pathname, item.href)
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:text-primary hover:bg-primary/5 ${active ? "text-primary" : "text-muted-foreground"}`}
                                >
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden lg:flex items-center gap-2">
                        {user ? (
                            <>
                                {role === 'student' && (
                                    <Link
                                        href="/dashboard/wallet"
                                        className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 bg-primary/5 text-primary rounded-full border border-primary/10 hover:bg-primary/10 transition-colors"
                                    >
                                        <Wallet className="h-4 w-4" />
                                        <span className="text-sm font-black">{profile?.wallet_balance || 0} ج.م</span>
                                    </Link>
                                )}
                                {isBackoffice ? (
                                    <Button variant="outline" className="whitespace-nowrap border-primary text-primary hover:bg-primary hover:text-white" asChild>
                                        <Link href={dashboardHref}>{dashboardLabel}</Link>
                                    </Button>
                                ) : (
                                    <Button variant="ghost" className="whitespace-nowrap" asChild>
                                        <Link href={dashboardHref}>{dashboardLabel}</Link>
                                    </Button>
                                )}
                                <Button variant="outline" onClick={handleLogout} className="whitespace-nowrap" aria-label="تسجيل الخروج" title="تسجيل الخروج">
                                    <LogOut className="h-4 w-4 xl:hidden" />
                                    <span className="hidden xl:inline">خروج</span>
                                </Button>
                                <Avatar className="h-8 w-8" title={[profile?.full_name, roleLabel].filter(Boolean).join(" — ") || undefined}>
                                    <AvatarImage src={profile?.avatar_url} />
                                    <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" className="whitespace-nowrap" asChild>
                                    <Link href="/login">تسجيل الدخول</Link>
                                </Button>
                                <Button className="whitespace-nowrap" asChild>
                                    <Link href="/signup">ابدأ الآن</Link>
                                </Button>
                            </>
                        )}
                    </div>
                    <ThemeToggle />

                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="lg:hidden h-11 w-11 rounded-xl">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">فتح القائمة</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" showCloseButton={false} className="w-[280px] max-w-[85vw] overflow-y-auto">
                            <SheetHeader className="sr-only">
                                <SheetTitle>قائمة الملاحة</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-5 px-4 py-4" dir="rtl">
                                <div className="flex items-center justify-between gap-2">
                                    <Link href="/" className="flex min-h-11 items-center gap-2" onClick={() => setIsSheetOpen(false)}>
                                        <GraduationCap className="h-7 w-7 text-primary" />
                                        <span className="font-bold text-lg">أكاديمية المنارة</span>
                                    </Link>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setIsSheetOpen(false)}>
                                        <X className="h-5 w-5" />
                                        <span className="sr-only">إغلاق القائمة</span>
                                    </Button>
                                </div>

                                {user && (
                                    <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={profile?.avatar_url} />
                                            <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-sm">{profile?.full_name || "حسابي"}</p>
                                            {roleLabel && <p className="text-xs text-muted-foreground">{roleLabel}</p>}
                                        </div>
                                    </div>
                                )}

                                <nav className="flex flex-col gap-1" aria-label="التنقل الرئيسي">
                                    {navItems.map((item) => {
                                        const active = isActive(pathname, item.href)
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsSheetOpen(false)}
                                                aria-current={active ? "page" : undefined}
                                                className={`flex min-h-11 items-center text-base font-medium px-3 rounded-xl transition-colors ${active ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"}`}
                                            >
                                                {item.name}
                                            </Link>
                                        )
                                    })}
                                    <Link
                                        href="/about"
                                        onClick={() => setIsSheetOpen(false)}
                                        className={`flex min-h-11 items-center text-sm px-3 rounded-xl transition-colors text-muted-foreground ${isActive(pathname, "/about") ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"}`}
                                    >
                                        عن المنصة
                                    </Link>
                                </nav>

                                <hr />

                                {user ? (
                                    <div className="flex flex-col gap-1">
                                        {role === 'student' && (
                                            <Link
                                                href="/dashboard/wallet"
                                                onClick={() => setIsSheetOpen(false)}
                                                className="flex min-h-11 items-center justify-between gap-2 px-3 rounded-xl text-base font-medium hover:bg-muted"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Wallet className="h-4 w-4 text-primary" />
                                                    المحفظة
                                                </span>
                                                <span className="text-sm font-black text-primary">{profile?.wallet_balance || 0} ج.م</span>
                                            </Link>
                                        )}
                                        <Link
                                            href={dashboardHref}
                                            onClick={() => setIsSheetOpen(false)}
                                            className={`flex min-h-11 items-center gap-2 text-base font-medium px-3 rounded-xl transition-colors ${isActive(pathname, dashboardHref) ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"}`}
                                        >
                                            {isBackoffice ? <ShieldCheck className="h-4 w-4 text-primary" /> : <LayoutDashboard className="h-4 w-4 text-primary" />}
                                            {dashboardLabel}
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsSheetOpen(false)
                                                handleLogout()
                                            }}
                                            className="flex min-h-11 items-center gap-2 text-base font-medium px-3 rounded-xl text-destructive hover:bg-destructive/10 text-right"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            تسجيل الخروج
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Link
                                            href="/login"
                                            onClick={() => setIsSheetOpen(false)}
                                            className="flex min-h-11 items-center justify-center text-base font-medium px-3 rounded-xl border hover:bg-muted"
                                        >
                                            تسجيل الدخول
                                        </Link>
                                        <Link
                                            href="/signup"
                                            onClick={() => setIsSheetOpen(false)}
                                            className="flex min-h-11 items-center justify-center text-base font-bold px-3 rounded-xl bg-primary text-primary-foreground"
                                        >
                                            ابدأ الآن
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
