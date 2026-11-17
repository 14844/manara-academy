"use client"

import React from "react"
import { AlertTriangle, RefreshCw, Monitor, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WebGLFallbackProps {
  errorMessage?: string
  onRetry?: () => void
}

export function WebGLFallback({ errorMessage, onRetry }: WebGLFallbackProps) {
  return (
    <div
      className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 text-white rounded-3xl border border-white/10"
      dir="rtl"
    >
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-400">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <h3 className="text-2xl font-black mb-3">تعذّر تشغيل المختبر ثلاثي الأبعاد</h3>
      <p className="text-muted-foreground text-sm max-w-md mb-6 leading-relaxed">
        {errorMessage ||
          "يبدو أن متصفحك أو جهازك الحالي لا يدعم تسريع الرسوميات ثلاثية الأبعاد (WebGL) أو تم تعطيله في إعدادات الأمان."}
      </p>

      <div className="glass p-4 rounded-xl border border-white/10 text-xs text-right max-w-md w-full mb-6 space-y-2 text-slate-300">
        <div className="font-bold text-white flex items-center gap-1.5 mb-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span>خطوات مقترحة لحل المشكلة:</span>
        </div>
        <p>1. تأكد من تفعيل «التسريع المادي» (Hardware Acceleration) في إعدادات المتصفح.</p>
        <p>2. جرّب تحديث متصفحك إلى أحدث إصدار من Google Chrome أو Microsoft Edge أو Safari.</p>
        <p>3. تأكد من تحديث تعريفات بطاقة الرسوميات (GPU Drivers) الخاصة بجهازك.</p>
      </div>

      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} className="gap-2 font-bold">
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
        )}
        <Button variant="outline" onClick={() => window.location.reload()} className="gap-2 font-bold glass">
          <Monitor className="w-4 h-4" />
          تحديث الصفحة
        </Button>
      </div>
    </div>
  )
}
