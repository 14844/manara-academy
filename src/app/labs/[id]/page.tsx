"use client"

import { useParams } from "next/navigation"
import { virtualLabs } from "@/lib/labs-data"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Maximize2, RotateCcw } from "lucide-react"
import { useState, useRef } from "react"
import { CircuitLab } from "@/components/labs/circuit-lab"
import { MoleculeLab } from "@/components/labs/molecule-lab"
import { FunctionLab } from "@/components/labs/function-lab"

export default function LabViewerPage() {
    const { id } = useParams()
    const lab = virtualLabs.find(l => l.id === id)
    const [resetKey, setResetKey] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    if (!lab) {
        return (
            <div className="min-h-screen flex flex-col bg-background" dir="rtl">
                <Navbar />
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <h2 className="text-2xl font-bold text-foreground mb-4">التجربة غير موجودة</h2>
                    <Button asChild>
                        <Link href="/labs">العودة للمختبرات الافتراضية</Link>
                    </Button>
                </div>
            </div>
        )
    }

    const handleReset = () => {
        setResetKey(prev => prev + 1)
    }

    const handleFullscreen = () => {
        if (containerRef.current) {
            const container = containerRef.current
            if (container.requestFullscreen) {
                container.requestFullscreen()
            } else if ((container as any).mozRequestFullScreen) {
                (container as any).mozRequestFullScreen()
            } else if ((container as any).webkitRequestFullscreen) {
                (container as any).webkitRequestFullscreen()
            } else if ((container as any).msRequestFullscreen) {
                (container as any).msRequestFullscreen()
            }
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-background" dir="rtl">
            <Navbar />
            <main className="flex-1 py-6 flex flex-col justify-center">
                <div className="container max-w-6xl mx-auto px-4 flex-1 flex flex-col justify-between">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs font-semibold">
                                <Link href="/labs" className="hover:text-primary transition-colors">
                                    المختبرات الافتراضية
                                </Link>
                                <span>/</span>
                                <span className="text-foreground">{lab.title}</span>
                            </div>
                            <h1 className="text-3xl font-black text-foreground">{lab.title}</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button variant="outline" className="glass h-11 px-5 rounded-xl font-bold" onClick={handleReset}>
                                <RotateCcw className="w-4 h-4 ml-2" />
                                إعادة تشغيل
                            </Button>
                            <Button variant="outline" className="glass h-11 px-5 rounded-xl font-bold" onClick={handleFullscreen}>
                                <Maximize2 className="w-4 h-4 ml-2" />
                                ملء الشاشة
                            </Button>
                            <Button className="h-11 px-5 rounded-xl font-bold" asChild>
                                <Link href="/labs">
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                    العودة للمختبرات
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div 
                        ref={containerRef} 
                        className="glass-card border border-white/20 p-1 h-[72vh] min-h-[480px] rounded-[2rem] relative shadow-2xl flex flex-col bg-white/5 overflow-hidden"
                    >
                        {lab.id === "circuit-construction-kit" && <CircuitLab key={resetKey} />}
                        {lab.id === "build-a-molecule" && <MoleculeLab key={resetKey} />}
                        {lab.id === "function-builder" && <FunctionLab key={resetKey} />}
                    </div>
                    
                    <div className="mt-6 p-4 glass rounded-2xl border border-white/10 text-sm text-muted-foreground leading-relaxed">
                        <strong>💡 ملاحظة تعليمية:</strong> تم تطوير هذه المحاكاة التفاعلية بالكامل محلياً (Natively) لتمنحك أداءً سريعاً وخفيفاً وتوافقاً كاملاً مع الجوال واللمس. اضغط على "ملء الشاشة" لتجربة غامرة وممتازة، أو "إعادة تشغيل" لإعادة التجربة إلى حالتها الافتراضية.
                    </div>
                </div>
            </main>
        </div>
    )
}

