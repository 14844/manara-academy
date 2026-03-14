"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BarChart3,
    BookOpen,
    LayoutDashboard,
    Settings,
    Users,
    PlusCircle,
    GraduationCap,
    LogOut,
    Wallet,
    ClipboardList
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "../../components/user-nav"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"

const sidebarItems = [
    { name: "لوحة التحكم", href: "/instructor", icon: LayoutDashboard },
    { name: "كورساتي", href: "/instructor/courses", icon: BookOpen },
    { name: "الطلاب", href: "/instructor/students", icon: Users },
    { name: "تصحيح الإجابات", href: "/instructor/grading", icon: ClipboardList },
    { name: "الإحصائيات", href: "/instructor/analytics", icon: BarChart3 },
    { name: "المحفظة والأرباح", href: "/instructor/withdrawals", icon: Wallet },
    { name: "الإعدادات", href: "/instructor/settings", icon: Settings },
]

import { StatusGuard } from "@/components/auth/status-guard"

export default function InstructorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    const [isSheetOpen, setIsSheetOpen] = useState(false)

    return (
        <StatusGuard>
            <div className="flex min-h-screen bg-muted/30">
                {/* Sidebar */}
                <aside className="hidden w-64 border-l bg-background md:block">
                    <div className="flex h-full flex-col gap-2">
                        <div className="flex h-16 items-center border-b px-6">
                            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                                <GraduationCap className="h-6 w-6 text-primary" />
                                <span>أكاديمية المنارة</span>
                            </Link>
                        </div>
                        <div className="flex-1 px-4 py-4">
                            <nav className="grid gap-1">
                                {sidebarItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted ${pathname === item.href ? "bg-muted text-primary" : "text-muted-foreground"
                                            }`}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.name}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                        <div className="mt-auto border-t p-4">
                            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" asChild>
                                <Link href="/logout">
                                    <LogOut className="h-4 w-4" />
                                    تسجيل الخروج
                                </Link>
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
                        <div className="flex items-center gap-4">
                            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="md:hidden">
                                        <Menu className="h-5 w-5" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-64 p-0">
                                    <SheetHeader className="p-6 border-b text-right">
                                        <SheetTitle className="flex items-center gap-2 font-bold text-xl">
                                            <GraduationCap className="h-6 w-6 text-primary" />
                                            <span>أكاديمية المنارة</span>
                                        </SheetTitle>
                                    </SheetHeader>
                                    <div className="flex h-full flex-col gap-2">
                                        <div className="flex-1 px-4 py-4">
                                            <nav className="grid gap-1">
                                                {sidebarItems.map((item) => (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={() => setIsSheetOpen(false)}
                                                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted ${pathname === item.href ? "bg-muted text-primary" : "text-muted-foreground"
                                                            }`}
                                                    >
                                                        <item.icon className="h-4 w-4" />
                                                        {item.name}
                                                    </Link>
                                                ))}
                                            </nav>
                                        </div>
                                        <div className="mt-auto border-t p-4">
                                            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" asChild onClick={() => setIsSheetOpen(false)}>
                                                <Link href="/logout">
                                                    <LogOut className="h-4 w-4" />
                                                    تسجيل الخروج
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                            <h1 className="text-lg font-semibold md:hidden">أكاديمية المنارة</h1>
                        </div>
                        <div className="flex items-center gap-4 mr-auto">
                            <Button size="sm" className="hidden sm:flex rounded-xl font-bold" asChild>
                                <Link href="/instructor/courses/new">
                                    <PlusCircle className="ml-2 h-4 w-4" />
                                    كورس جديد
                                </Link>
                            </Button>
                            <ThemeToggle />
                            <UserNav />
                        </div>
                    </header>
                    <main className="flex-1 p-6 md:p-8">
                        {children}
                    </main>
                </div>
            </div>
        </StatusGuard>
    )
}
