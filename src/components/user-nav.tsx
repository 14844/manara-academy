"use client"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import Link from "next/link"

export function UserNav() {
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

    if (!user) return null

    return (
        <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-primary/20 hover:border-primary/50 transition-all">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || "User"} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                            {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-4">
                    <div className="flex flex-col space-y-2">
                        <p className="text-sm font-black leading-none">{profile?.full_name || "مستخدم المنارة"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                        <Badge variant="outline" className="w-fit text-[10px] mt-1">
                            {profile?.role === 'admin' ? 'مدير المنصة' : profile?.role === 'instructor' ? 'مدرس' : 'طالب'}
                        </Badge>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup className="p-1">
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                        <Link href={profile?.role === 'instructor' ? '/instructor/settings' : profile?.role === 'admin' ? '/admin/settings' : '/profile/edit'}>
                            الملف الشخصي
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                        <Link href={profile?.role === 'instructor' ? '/instructor' : profile?.role === 'admin' ? '/admin' : '/dashboard'}>
                            لوحة التحكم
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Link href="/logout">
                        تسجيل الخروج
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
