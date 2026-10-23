"use client"

import { useState, useRef, useEffect } from "react"
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
    RefreshCw,
    ShieldAlert
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { motion } from "framer-motion"

interface SecurePdfViewerProps {
    fileUrl: string
    title: string
    description?: string
    instructorName?: string
    studentName?: string
    studentEmail?: string
    studentId?: string
    courseId?: string
}


/** Renders the PDF pages onto canvases (no iframe / no external viewer), so the watermark overlay stays on top. */
function PdfPages({ fileUrl, zoom, hidden, onFail }: { fileUrl: string; zoom: number; hidden: boolean; onFail: () => void }) {
    const hostRef = useRef<HTMLDivElement>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        let doc: any = null
        const host = hostRef.current
        if (!host) return
        host.innerHTML = ""
        setLoading(true)

        ;(async () => {
            try {
                const pdfjs = await import("pdfjs-dist")
                pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
                const res = await fetch(fileUrl, { credentials: "same-origin" })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = new Uint8Array(await res.arrayBuffer())
                doc = await pdfjs.getDocument({
                    data,
                    standardFontDataUrl: "/pdfjs/standard_fonts/",
                    cMapUrl: "/pdfjs/cmaps/",
                    cMapPacked: true,
                    useSystemFonts: false,
                    isEvalSupported: false,
                }).promise
                const dpr = Math.min(window.devicePixelRatio || 1, 2)
                for (let i = 1; i <= doc.numPages; i++) {
                    if (cancelled) return
                    const page = await doc.getPage(i)
                    const base = page.getViewport({ scale: 1 })
                    const cssWidth = Math.max(host.clientWidth || 800, 300)
                    const scale = (cssWidth / base.width) * dpr
                    const viewport = page.getViewport({ scale })
                    const canvas = document.createElement("canvas")
                    canvas.width = Math.floor(viewport.width)
                    canvas.height = Math.floor(viewport.height)
                    canvas.style.width = "100%"
                    canvas.style.display = "block"
                    canvas.style.background = "#fff"
                    canvas.style.marginBottom = "8px"
                    const ctx = canvas.getContext("2d")
                    if (!ctx) continue
                    host.appendChild(canvas)
                    await page.render({ canvasContext: ctx, viewport }).promise
                    if (i === 1) setLoading(false)
                }
                setLoading(false)
            } catch (err) {
                console.error("PDF render failed", err)
                if (!cancelled) onFail()
            }
        })()

        return () => {
            cancelled = true
            try { doc?.destroy() } catch {}
        }
    }, [fileUrl, onFail])

    return (
        <div
            className="relative w-full h-[80vh] overflow-y-auto bg-zinc-800 p-2"
            onContextMenu={(e) => e.preventDefault()}
        >
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm gap-2 pointer-events-none">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    جاري تحميل الملف...
                </div>
            )}
            <div
                ref={hostRef}
                style={{
                    width: `${zoom}%`,
                    margin: "0 auto",
                    opacity: hidden ? 0 : 1,
                    filter: hidden ? "blur(40px)" : "none",
                    transition: "opacity 60ms linear",
                    userSelect: "none",
                }}
            />
        </div>
    )
}

export function SecurePdfViewer({
    fileUrl,
    title,
    description,
    instructorName = "معلم المادة",
    studentName,
    studentEmail,
    studentId,
    courseId,
}: SecurePdfViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [zoom, setZoom] = useState(100)
    const [renderFailed, setRenderFailed] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Anti-capture: hide the document when the window loses focus or capture tools are used
    const [isBlocked, setIsBlocked] = useState(false)
    const [blockReason, setBlockReason] = useState("")

    useEffect(() => {
        const block = (reason: string) => {
            setIsBlocked(true)
            setBlockReason(reason)
        }
        const onVisibility = () => {
            if (document.hidden) block("تم حجب المحتوى مؤقتاً لخروجك من نافذة الدرس.")
            else setIsBlocked(false)
        }
        const onBlur = () => block("تم حجب المحتوى مؤقتاً لخروجك من نافذة الدرس. سيعود بمجرد عودتك.")
        const onFocus = () => setIsBlocked(false)
        const onKey = (e: KeyboardEvent) => {
            const key = e.key
            const ctrl = e.ctrlKey || e.metaKey
            const isSnip = ctrl && e.shiftKey && (key === "S" || key === "s" || key === "4" || key === "5")
            const isPrintScreen = key === "PrintScreen" || e.code === "PrintScreen"
            const isWinKey = key === "Meta" || key === "OS"
            const isSavePrint = ctrl && (key === "p" || key === "P" || key === "s" || key === "S")
            if (isSnip || isPrintScreen || isWinKey || isSavePrint) {
                e.preventDefault()
                if (isPrintScreen) {
                    try { navigator.clipboard?.writeText("") } catch {}
                }
                block("تم حجب المحتوى وقائياً. أدوات لقطة الشاشة أو الطباعة غير مسموحة.")
            }
        }
        const md = navigator.mediaDevices as unknown as Record<string, unknown> | undefined
        const originalDisplayMedia = md?.getDisplayMedia
        if (md && originalDisplayMedia) {
            md.getDisplayMedia = async () => {
                block("مشاركة أو تسجيل الشاشة غير مسموح أثناء عرض الملفات.")
                throw new Error("Screen sharing blocked")
            }
        }
        let devOpen = false
        const interval = setInterval(() => {
            if (document.fullscreenElement) return
            const opened = window.outerWidth - window.innerWidth > 250 || window.outerHeight - window.innerHeight > 250
            if (opened && !devOpen) {
                devOpen = true
                block("تم حجب المحتوى لأن أدوات المطور مفتوحة. أغلقها للمتابعة.")
            } else if (!opened && devOpen) {
                devOpen = false
                setIsBlocked(false)
            }
        }, 1000)

        document.addEventListener("visibilitychange", onVisibility)
        window.addEventListener("blur", onBlur)
        window.addEventListener("focus", onFocus)
        window.addEventListener("keydown", onKey, { capture: true })
        window.addEventListener("keyup", onKey, { capture: true })
        return () => {
            document.removeEventListener("visibilitychange", onVisibility)
            window.removeEventListener("blur", onBlur)
            window.removeEventListener("focus", onFocus)
            window.removeEventListener("keydown", onKey, { capture: true })
            window.removeEventListener("keyup", onKey, { capture: true })
            clearInterval(interval)
            if (md && originalDisplayMedia) md.getDisplayMedia = originalDisplayMedia
        }
    }, [])

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

    // Downloads always go through our server (/api/storage/sign), which stamps the PDF with the student's code + email.
    const downloadUrl = (() => {
        if (!fileUrl) return fileUrl
        const fileName = encodeURIComponent(`${title || "file"}.pdf`)
        try {
            const u = new URL(fileUrl, window.location.origin)
            if (u.pathname === "/api/storage/sign") {
                u.searchParams.set("download", "1")
                u.searchParams.set("name", `${title || "file"}.pdf`)
                return u.pathname + u.search
            }
            const m = u.pathname.match(/\/object\/(?:sign|authenticated|public)\/[^/]+\/(.+)$/)
            if (m && courseId) {
                const storagePath = decodeURIComponent(m[1])
                return `/api/storage/sign?url=${encodeURIComponent(storagePath)}&courseId=${encodeURIComponent(courseId)}&download=1&name=${fileName}`
            }
        } catch {}
        return fileUrl
    })()

    const studentCodeText = studentId ? `كود: ${studentId}` : ""
    const studentEmailText = studentEmail || ""
    const watermarkText = [studentCodeText, studentEmailText, instructorName, "أكاديمية المنارة"].filter(Boolean).join(" • ")

    return (
        <div
            ref={containerRef}
            onContextMenu={(e) => e.preventDefault()}
            className={`secure-pdf-root flex flex-col bg-background border rounded-2xl shadow-xl overflow-hidden font-arabic transition-all duration-300 ${
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
                        <a href={downloadUrl} download>
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

                {/* Moving Watermark Badge (Slow Floating Across Frame) */}
                <motion.div
                    initial={{ left: "10%", top: "15%" }}
                    animate={{
                        left: ["10%", "75%", "75%", "10%", "10%"],
                        top: ["15%", "15%", "75%", "75%", "15%"],
                    }}
                    transition={{
                        duration: 80,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    style={{ position: 'absolute' }}
                    className="pointer-events-none z-30 select-none"
                >
                    <div className="bg-black/60 backdrop-blur-[2px] px-3.5 py-1.5 rounded-lg border border-white/20 flex flex-col items-center shadow-2xl">
                        <span className="text-[12px] md:text-xs font-mono font-bold text-white/90">
                            {studentId ? `كود الطالب: ${studentId}` : "أكاديمية المنارة"}
                        </span>
                        {studentEmail && (
                            <span className="text-[10px] text-white/70 font-medium">
                                {studentEmail}
                            </span>
                        )}
                    </div>
                </motion.div>

                <style>{`@media print { .secure-pdf-root { display: none !important; } }`}</style>
                {isBlocked && (
                    <div
                        className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
                        style={{ pointerEvents: "all" }}
                    >
                        <div className="bg-destructive/10 text-destructive h-20 w-20 rounded-full flex items-center justify-center mb-4 border border-destructive/20 animate-pulse">
                            <ShieldAlert className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">محتوى محمي آمن</h3>
                        <p className="max-w-md text-sm text-zinc-300 leading-relaxed">{blockReason}</p>
                        <Button
                            variant="outline"
                            className="mt-6 border-white/20 text-white hover:bg-white/10"
                            onClick={() => setIsBlocked(false)}
                        >
                            فهمت ذلك، العودة للملف
                        </Button>
                    </div>
                )}

                {/* Embedded Viewer Iframe / Object */}
                <div
                    className="w-full h-full min-h-[550px] transition-transform duration-200 origin-top"
                >
                    {isPdf && !renderFailed ? (
                        <PdfPages fileUrl={fileUrl} zoom={zoom} hidden={isBlocked} onFail={() => setRenderFailed(true)} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[550px] text-white p-8 text-center space-y-4">
                            <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center text-primary">
                                <FileText className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold">{title}</h4>
                                <p className="text-xs text-zinc-400 mt-1">
                                    {renderFailed ? "تعذر عرض الملف داخل الصفحة، يمكنك تحميله من الزر أدناه" : "الملف متاح للتحميل والاطلاع عبر الزر أدناه"}
                                </p>
                            </div>
                            <Button size="lg" className="gap-2 font-bold" asChild>
                                <a href={downloadUrl} download>
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
