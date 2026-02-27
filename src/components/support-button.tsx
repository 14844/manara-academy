"use client"

import { MessageCircle, Phone, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function SupportButton() {
    const [isOpen, setIsOpen] = useState(false)
    const whatsappNumber = "201017333215"
    const whatsappLink = `https://wa.me/${whatsappNumber}`
    const supportEmail = "manaraacademyplatform@gmail.com"

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform bg-primary text-primary-foreground border-4 border-background"
                    >
                        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-72 p-0 overflow-hidden border-2 mb-2 font-arabic" sideOffset={10}>
                    <div className="bg-primary p-4 text-primary-foreground">
                        <h3 className="font-bold text-lg">تحتاج للمساعدة؟</h3>
                        <p className="text-xs opacity-90 mt-1">فريق الدعم متاح للرد على استفساراتك.</p>
                    </div>
                    <div className="p-4 space-y-3 bg-background">
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors group"
                        >
                            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-green-500 text-white font-bold group-hover:scale-110 transition-transform">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold">تواصل عبر واتساب</p>
                                <p className="text-[10px] text-muted-foreground italic">رد سريع ومباشر</p>
                            </div>
                        </a>
                        <a
                            href="https://mail.google.com/mail/?view=cm&fs=1&to=manaraacademyplatform@gmail.com"
                            target="_blank"
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors group"
                        >
                            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold">مراسلتنا عبر البريد</p>
                                <p className="text-[10px] text-muted-foreground italic">Gmail</p>
                            </div>
                        </a>
                        <p className="text-[10px] text-center text-muted-foreground pt-2">
                            ساعات العمل: ٩ صباحاً - ٩ مساءً
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
