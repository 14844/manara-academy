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
import { Menu, X, GraduationCap, LayoutDashboard, LogOut, Settings, Wallet } from "lucide-react"

const navItems = [
    { name: "الرئيسية", href: "/" },
    { name: "تصفح الكورسات", href: "/courses" },
    { name: "عن المنصة", href: "/about" },
]

export function Navbar() {
    const pathname = usePathname()
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            if (currentUser) {
                const docRef = doc(db, "profiles", currentUser.uid)
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                    setProfile(docSnap.data())
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

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-6 md:gap-10">
                    <Link href="/" className="flex items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-primary shrink-0" />
                        <span className="hidden sm:inline-block font-bold text-xl whitespace-nowrap">أكاديمية المنارة</span>
                        <span className="sm:hidden font-bold text-lg whitespace-nowrap">المنارة</span>
                    </Link>
                    <nav className="hidden md:flex gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`text-sm font-medium transition-colors hover:text-primary ${pathname === item.href ? "text-primary" : "text-muted-foreground"
                                    }`}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-2">
                        {user ? (
                            <div className="flex items-center gap-4">
                                {profile?.role === 'admin' && (
                                    <Link href="/admin">
                                        <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">إدارة المنصة</Button>
                                    </Link>
                                )}
                                {profile?.role === 'student' && (
                                    <Link href="/dashboard/wallet">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 text-primary rounded-full border border-primary/10 hover:bg-primary/10 transition-colors">
                                            <Wallet className="h-4 w-4" />
                                            <span className="text-sm font-black">{profile?.wallet_balance || 0} ج.م</span>
                                        </div>
                                    </Link>
                                )}
                                <Link href={profile?.role === 'instructor' ? '/instructor' : '/dashboard'}>
                                    <Button variant="ghost">لوحة التحكم</Button>
                                </Link>
                                <Button variant="outline" onClick={handleLogout}>خروج</Button>
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={profile?.avatar_url} />
                                    <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                            </div>
                        ) : (
                            <>
                                <Button variant="ghost" asChild>
                                    <Link href="/login">تسجيل الدخول</Link>
                                </Button>
                                <Button asChild>
                                    <Link href="/signup">ابدأ الآن</Link>
                                </Button>
                            </>
                        )}
                    </div>
                    <ThemeToggle />

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">فتح القائمة</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                            <SheetHeader className="sr-only">
                                <SheetTitle>قائمة الملاحة</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-6 py-4">
                                <Link href="/" className="flex items-center gap-2">
                                    <GraduationCap className="h-7 w-7 text-primary" />
                                    <span className="font-bold text-lg">أكاديمية المنارة</span>
                                </Link>
                                <nav className="flex flex-col gap-4">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`text-base font-medium p-2 rounded-lg transition-colors ${pathname === item.href ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                                                }`}
                                        >
                                            {item.name}
                                        </Link>
                                    ))}
                                    <hr className="my-2" />
                                    {user ? (
                                        <div className="flex flex-col gap-2">
                                            <Link href={profile?.role === 'instructor' ? '/instructor' : '/dashboard'} className={`text-base font-medium p-2 rounded-lg transition-colors ${pathname === (profile?.role === 'instructor' ? '/instructor' : '/dashboard') ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                                                }`}>
                                                لوحة التحكم
                                            </Link>
                                            <button onClick={handleLogout} className="text-base font-medium p-2 rounded-lg text-destructive hover:bg-destructive/10 text-right">
                                                تسجيل الخروج
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <Link href="/login" className="text-base font-medium p-2 rounded-lg hover:bg-muted">
                                                تسجيل الدخول
                                            </Link>
                                            <Link href="/signup" className="text-base font-medium p-2 rounded-lg bg-primary text-primary-foreground text-center">
                                                ابدأ الآن
                                            </Link>
                                        </div>
                                    )}
                                </nav>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
