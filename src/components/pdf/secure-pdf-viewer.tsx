"use client"

import { useState, useRef } from "react"
import {
    FileText,
    Shield,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
    Download,
    Eye,
    GraduationCap,
    Lock,
    ExternalLink,
    RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface SecurePdfViewerProps {
    fileUrl: string
    title: string
    description?: string
    instructorName?: string
    studentName?: string
    studentEmail?: string
}

export function SecurePdfViewer({
    fileUrl,
    title,
    description,
    instructorName = "معلم المادة",
    studentName,
    studentEmail,
}: SecurePdfViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [zoom, setZoom] = useState(100)
    const [viewMode, setViewMode] = useState<"embedded" | "direct">("embedded")
    const containerRef = useRef<HTMLDivElement>(null)

    const isPdf = fileUrl?.toLowerCase().includes(".pdf") || fileUrl?.includes("pdf")

    const toggleFullscreen = () => {
        if (!containerRef.current) return
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => console.error(err))
            setIsFullscreen(true)
        } else {
            document.exitFullscreen().catch(err => console.error(err))
            setIsFullscreen(false)
        }
    }

    // Google Docs Viewer fallback url for cross-origin or storage PDFs
    const embeddedViewerUrl = isPdf
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
        : fileUrl

    const watermarkText = `أكاديمية المنارة • ${instructorName} • ${studentName || studentEmail || "طالب معتمد"}`

    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-background border rounded-2xl shadow-xl overflow-hidden font-arabic transition-all duration-300 ${
                isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen" : "w-full"
            }`}
        >
            {/* Header / Brand Top Bar */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base line-clamp-1">{title}</h3>
                            <Badge variant="secondary" className="text-[10px] gap-1 py-0.5 px-2 bg-primary/10 text-primary border-primary/20">
                                <Shield className="h-3 w-3" />
                                محتوى محمي
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1 font-medium">
                                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                                إعداد الأستاذ: <strong className="text-foreground">{instructorName}</strong>
                            </span>
                            <span>•</span>
                            <span className="text-[11px] text-primary/80 font-bold">أكاديمية المنارة التعليمية 🌟</span>
                        </div>
                    </div>
                </div>

                {/* Toolbar Controls */}
                <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setZoom(prev => Math.min(prev + 15, 160))}
                        title="تكبير"
                    >
                        <ZoomIn className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">تكبير</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setZoom(prev => Math.max(prev - 15, 75))}
                        title="تصغير"
                    >
                        <ZoomOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">تصغير</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs gap-1.5 font-bold"
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{isFullscreen ? "إنهاء العرض" : "ملء الشاشة"}</span>
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 px-3 text-xs gap-1.5 shadow-sm font-bold"
                        asChild
                    >
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-3.5 w-3.5" />
                            <span>تحميل</span>
                        </a>
                    </Button>
                </div>
            </div>

            {/* Main Document Frame Area */}
            <div className="relative flex-1 bg-zinc-900 min-h-[550px] overflow-hidden flex items-center justify-center select-none">
                {/* Dynamic Repeating Watermark Overlay */}
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden opacity-25 flex flex-wrap content-around justify-around p-8 select-none">
                    {Array.from({ length: 12 }).map((_, idx) => (
                        <div
                            key={idx}
                            className="transform -rotate-25 text-white/40 text-xs md:text-sm font-bold tracking-widest whitespace-nowrap p-6"
                        >
                            {watermarkText}
                        </div>
                    ))}
                </div>

                {/* Embedded Viewer Iframe / Object */}
                <div
                    className="w-full h-full min-h-[550px] transition-transform duration-200 origin-top"
                    style={{ transform: `scale(${zoom / 100})` }}
                >
                    {isPdf ? (
                        <iframe
                            src={embeddedViewerUrl}
                            className="w-full h-full min-h-[600px] border-0 bg-white"
                            title={title}
                            allowFullScreen
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[550px] text-white p-8 text-center space-y-4">
                            <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center text-primary">
                                <FileText className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold">{title}</h4>
                                <p className="text-xs text-zinc-400 mt-1">الملف متاح للتحميل والاطلاع عبر الزر أدناه</p>
                            </div>
                            <Button size="lg" className="gap-2 font-bold" asChild>
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                    تحميل أو فتح الملف
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Document Footer & Description Section */}
            {description && (
                <div className="p-5 bg-muted/20 border-t space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <FileText className="h-3.5 w-3.5" />
                        <span>ملاحظات وإرشادات المعلم حول الملف:</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-background/60 p-4 rounded-xl border">
                        {description}
                    </p>
                </div>
            )}
        </div>
    )
}
