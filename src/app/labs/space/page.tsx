"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Loader2, Maximize2, RotateCcw } from "lucide-react"
import { useState, useRef } from "react"
import dynamic from "next/dynamic"

const labLoading = () => (
  <div className="flex-1 flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
)

const SpaceLab = dynamic(() => import("@/components/labs/space-lab").then(m => m.SpaceLab), {
  ssr: false,
  loading: labLoading,
})

export default function SpaceLabPage() {
  const [resetKey, setResetKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleReset = () => {
    setResetKey(prev => prev + 1)
  }

  const handleFullscreen = () => {
    if (containerRef.current) {
      const container = containerRef.current
      if (container.requestFullscreen) {
        container.requestFullscreen()
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen()
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
                <span className="text-foreground">مختبر الفضاء والمجموعة الشمسية</span>
              </div>
              <h1 className="text-3xl font-black text-foreground">مختبر الفضاء والمجموعة الشمسية</h1>
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
            className="glass-card border border-white/20 p-1 h-[72vh] min-h-[480px] rounded-[2rem] relative shadow-2xl flex flex-col bg-slate-950 overflow-hidden"
          >
            <SpaceLab key={resetKey} />
          </div>

          <div className="mt-6 p-4 glass rounded-2xl border border-white/10 text-sm text-muted-foreground leading-relaxed">
            <strong>💡 ملاحظة تعليمية:</strong> تجول في المجموعة الشمسية بحرية! استخدم مؤشر الفأرة أو اللمس للدوران حول الشمس والتكبير. اضغط على أي كوكب لعرض بطاقة المعلومات الفيزيائية والفلكية الخاصة به، وجرّب حاسبة الوزن على الكواكب لاكتشاف تأثير الجاذبية المختلفة.
          </div>
        </div>
      </main>
    </div>
  )
}
