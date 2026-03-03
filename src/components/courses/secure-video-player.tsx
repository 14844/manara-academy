"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
    Loader2,
    RotateCcw,
    RotateCw,
    Settings,
    ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion, AnimatePresence } from "framer-motion"
import { db } from "@/lib/firebase/config"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"

// ── YouTube IFrame API types ──────────────────────────────────────────────────
declare global {
    interface Window {
        YT: {
            Player: new (
                el: HTMLElement | string,
                opts: {
                    videoId: string,
                    width?: string | number,
                    height?: string | number,
                    playerVars?: Record<string, unknown>,
                    events?: {
                        onReady?: (e: { target: YTPlayer }) => void
                        onStateChange?: (e: { data: number }) => void
                        onError?: (e: { data: number }) => void
                    }
                }
            ) => YTPlayer
            PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
        }
        onYouTubeIframeAPIReady: () => void
    }
}

interface YTPlayer {
    playVideo(): void
    pauseVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void
    getCurrentTime(): number
    getDuration(): number
    setVolume(vol: number): void
    mute(): void
    unMute(): void
    setPlaybackRate(rate: number): void
    destroy(): void
    getPlayerState(): number
    getIframe(): HTMLIFrameElement
}

// ─────────────────────────────────────────────────────────────────────────────

interface SecureVideoPlayerProps {
    courseId: string
    lessonId: string
    /** لا يُرسل videoPath للـ client - يُستبدل بـ API token */
    videoPath?: string
    userEmail?: string
    studentId?: string
    startTime?: number
}

/** فك تشفير الـ token القادم من الـ API */
function decodeToken(token: string): string {
    try {
        return atob(token)
    } catch (e) {
        console.error("Token decode error:", e)
        return ""
    }
}

export function SecureVideoPlayer({
    courseId,
    lessonId,
    userEmail,
    studentId,
    startTime = 0,
}: SecureVideoPlayerProps) {
    // ── Refs ─────────────────────────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const ytPlayerRef = useRef<YTPlayer | null>(null)
    const ytContainerRef = useRef<HTMLDivElement>(null)
    const ytReadyRef = useRef(false)
    // الـ videoId يُخزّن في ref فقط - لا يدخل الـ React state ولا يُعرض في الـ DOM
    const ytVideoIdRef = useRef<string | null>(null)
    const srcSetRef = useRef(false)

    // ── State ─────────────────────────────────────────────────────────────────
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [videoType, setVideoType] = useState<"youtube" | "drive" | "direct" | null>(null)
    const [directVideoUrl, setDirectVideoUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [blobUrl, setBlobUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isBlocked, setIsBlocked] = useState(false)
    const [blockReason, setBlockReason] = useState("")
    const [lastSavedTime, setLastSavedTime] = useState(0)
    const [isInitialized, setIsInitialized] = useState(false)
    const [ytReady, setYtReady] = useState(false)
    const [ytPlayerReady, setYtPlayerReady] = useState(false)

    // ── Derived ───────────────────────────────────────────────────────────────
    const youtubeId = ytVideoIdRef.current
    const isDrive = videoType === "drive"
    const isNativeVideo = videoType === "direct"

    // ══════════════════════════════════════════════════════════════════════════
    // 1. جلب الـ video token من الـ API (الـ videoPath لا يُرسل للـ client)
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!courseId || !lessonId) {
            setError("معرّف الدرس غير متاح")
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        setError(null)
        setYtReady(false)
        setVideoType(null)
        ytVideoIdRef.current = null
        ytReadyRef.current = false
        srcSetRef.current = false

        async function fetchToken() {
            try {
                // استخدام URL مطلق لضمان عدم حدوث مشاكل في المسارات المشفرة
                const url = new URL("/api/video/token", window.location.origin)
                url.searchParams.set("courseId", courseId)
                url.searchParams.set("lessonId", lessonId)

                const res = await fetch(url.toString(), { cache: 'no-store' })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    setError(data.error || "لا يوجد فيديو متاح حالياً")
                    setIsLoading(false)
                    return
                }
                const data = await res.json()

                if (data.type === "youtube") {
                    const decoded = decodeToken(data.token)
                    if (decoded) {
                        ytVideoIdRef.current = decoded
                        setVideoType("youtube")
                    } else {
                        setError("خطأ في فك تشفير بيانات يوتيوب")
                        setIsLoading(false)
                    }
                } else if (data.type === "drive") {
                    setDirectVideoUrl(data.url)
                    setVideoType("drive")
                    setIsLoading(false)
                } else if (data.type === "direct") {
                    try {
                        const videoRes = await fetch(data.url)
                        const blob = await videoRes.blob()
                        const bUrl = URL.createObjectURL(blob)
                        setBlobUrl(bUrl)
                        setDirectVideoUrl(data.url)
                        setVideoType("direct")
                        setIsLoading(false)
                    } catch (err) {
                        setDirectVideoUrl(data.url)
                        setVideoType("direct")
                        setIsLoading(false)
                    }
                } else {
                    setError("تنسيق الفيديو غير مدعوم")
                    setIsLoading(false)
                }
            } catch (err) {
                console.error("Token error:", err)
                setError("فشل الاتصال بخادم المحتوى. تأكد من اتصالك بالإنترنت.")
                setIsLoading(false)
            }
        }
        fetchToken()
        return () => {
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl)
                setBlobUrl(null)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, lessonId])

    // ══════════════════════════════════════════════════════════════════════════
    // 2. تحميل YouTube IFrame API وتهيئة المشغّل
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!youtubeId || videoType !== "youtube") return

        let timeout: NodeJS.Timeout
        let retryCount = 0
        const maxRetries = 10

        const initPlayer = () => {
            if (ytReadyRef.current) return

            if (!ytContainerRef.current) {
                if (retryCount < maxRetries) {
                    retryCount++
                    timeout = setTimeout(initPlayer, 200)
                } else {
                    setError("تعذر تهيئة مشغل الفيديو (حاوية مفقودة)")
                    setIsLoading(false)
                }
                return
            }

            ytReadyRef.current = true

            try {
                const player = new window.YT.Player(ytContainerRef.current, {
                    width: '100%',
                    height: '100%',
                    videoId: youtubeId,
                    playerVars: {
                        origin: window.location.protocol + "//" + window.location.host,
                        rel: 0,
                        modestbranding: 1,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                        controls: 0,
                        showinfo: 0,
                        playsinline: 1,
                        enablejsapi: 1,
                        start: Math.floor(startTime),
                    },
                    events: {
                        onReady: (e) => {
                            ytPlayerRef.current = e.target
                            const dur = e.target.getDuration()
                            setDuration(dur > 0 ? dur : 0)
                            setIsLoading(false)
                            setYtReady(true)
                            e.target.setVolume(volume * 100)
                        },
                        onStateChange: (e) => {
                            const YT = window.YT.PlayerState
                            if (e.data === YT.PLAYING) {
                                setIsPlaying(true)
                                const dur = ytPlayerRef.current?.getDuration() ?? 0
                                setDuration(dur)
                            } else if (e.data === YT.PAUSED || e.data === YT.ENDED) {
                                setIsPlaying(false)
                            }
                        },
                        onError: (e: { data: number }) => {
                            console.error("YouTube Player Error:", e.data)
                            setError("حدث خطأ في مشغل يوتيوب (رمز: " + e.data + ")")
                            setIsLoading(false)
                        }
                    },
                })
            } catch (err) {
                console.error("YT Player Init Error:", err)
                setError("فشل في تشغيل المحرك الآمن للفيديو")
                setIsLoading(false)
            }
        }

        // إيقاف التحميل إذا استغرق طويلاً (Fail-safe)
        const loadingTimeout = setTimeout(() => {
            if (!ytReadyRef.current) {
                setError("استغرق تحميل الفيديو وقتاً طويلاً. يرجى التنشيط.")
                setIsLoading(false)
            }
        }, 10000)

        if (window.YT?.Player) {
            initPlayer()
        } else {
            const checkYT = setInterval(() => {
                if (window.YT?.Player) {
                    clearInterval(checkYT)
                    initPlayer()
                }
            }, 500)

            // احتياطاً إذا لم يتم تحميل السكريبت أبداً
            if (!document.getElementById("yt-api-script")) {
                const script = document.createElement("script")
                script.id = "yt-api-script"
                script.src = "https://www.youtube.com/iframe_api"
                document.head.appendChild(script)
            }

            const oldReady = window.onYouTubeIframeAPIReady
            window.onYouTubeIframeAPIReady = () => {
                if (typeof oldReady === "function") oldReady()
                initPlayer()
            }

            timeout = setTimeout(() => clearInterval(checkYT), 10000)
        }

        return () => {
            if (timeout) clearTimeout(timeout)
            if (loadingTimeout) clearTimeout(loadingTimeout)
            ytReadyRef.current = false
            try {
                if (ytPlayerRef.current) {
                    ytPlayerRef.current.destroy()
                }
            } catch (e) {
                console.error("Error destroying YT player:", e)
            }
            ytPlayerRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [youtubeId, videoType])

    // ══════════════════════════════════════════════════════════════════════════
    // 3. تتبع الوقت الحالي لفيديو يوتيوب (polling)
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!youtubeId || !ytReady) return
        const interval = setInterval(() => {
            const t = ytPlayerRef.current?.getCurrentTime() ?? 0
            setCurrentTime(t)
        }, 500)
        return () => clearInterval(interval)
    }, [youtubeId, ytReady])

    // ══════════════════════════════════════════════════════════════════════════
    // 4. Resume – native video
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (videoRef.current && startTime > 0 && !isInitialized && !isLoading) {
            videoRef.current.currentTime = startTime
            setCurrentTime(startTime)
            setIsInitialized(true)
        }
    }, [startTime, isLoading, isInitialized])

    // ══════════════════════════════════════════════════════════════════════════
    // 5. حفظ التقدم
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!studentId || !lessonId || !isPlaying) return
        const save = async () => {
            if (Math.abs(currentTime - lastSavedTime) < 10) return
            try {
                await setDoc(
                    doc(db, "video_progress", `${studentId}_${lessonId}`),
                    {
                        student_id: studentId,
                        course_id: courseId,
                        lesson_id: lessonId,
                        current_time: currentTime,
                        duration,
                        updated_at: serverTimestamp(),
                    },
                    { merge: true }
                )
                setLastSavedTime(currentTime)
            } catch (e) {
                console.error("Error saving video progress:", e)
            }
        }
        const t = setTimeout(save, 1000)
        return () => clearTimeout(t)
    }, [currentTime, isPlaying, studentId, lessonId, courseId, lastSavedTime, duration])

    // ══════════════════════════════════════════════════════════════════════════
    // 6. حمايات Anti-Capture الشاملة
    // ══════════════════════════════════════════════════════════════════════════
    const pauseAny = useCallback(() => {
        videoRef.current?.pause()
        ytPlayerRef.current?.pauseVideo()
        setIsPlaying(false)
    }, [])

    useEffect(() => {
        // أ) تغيير التاب / إخفاء الصفحة فقط (وليس فتح DevTools أو النقر خارج المتصفح)
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                pauseAny()
                setIsBlocked(true)
                setBlockReason("تم إيقاف الفيديو لأنك انتقلت لتاب أو تطبيق آخر. المحتوى محمي.")
            } else {
                setIsBlocked(false)
            }
        }

        // ج) حماية الهواتف عند سحب القائمة العلوية أو فتح نافذة أخرى
        const onWindowBlur = () => {
            // في الموبايل، سحب قائمة الإشعارات أو الـ Control Center يطلق حدث blur
            pauseAny()
            setIsBlocked(true)
            setBlockReason("تم حجب المحتوى مؤقتاً لحماية حقوق النشر. يرجى العودة لصفحة الدرس.")
        }

        // ب) اختصارات لقطة الشاشة وتسجيلها
        const onKey = (e: KeyboardEvent) => {
            const isWinSnip = (e.key === "S" || e.key === "s") && e.shiftKey && (e.metaKey || e.ctrlKey)
            const isMacSnip = e.key === "4" && e.shiftKey && e.metaKey
            const isPrint = e.key === "PrintScreen"
            const isWinKey = e.key === "Meta" || e.key === "OS"

            if (isWinSnip || isMacSnip || isPrint || isWinKey) {
                e.preventDefault()
                pauseAny()
                setIsBlocked(true)
                setBlockReason("تم حجب المحتوى وقائياً. استخدام أدوات لقطة الشاشة أو تسجيل الشاشة محظور.")
            }
        }

        // ج) حجب مشاركة الشاشة عبر WebRTC
        if (navigator.mediaDevices && (navigator.mediaDevices as unknown as Record<string, unknown>).getDisplayMedia) {
            ; (navigator.mediaDevices as unknown as Record<string, unknown>).getDisplayMedia = async (..._args: unknown[]) => {
                pauseAny()
                setIsBlocked(true)
                setBlockReason("مشاركة الشاشة غير مسموح بها أثناء مشاهدة الدروس.")
                throw new Error("Screen sharing blocked by security policy")
            }
        }

        document.addEventListener("visibilitychange", onVisibility)
        window.addEventListener("blur", onWindowBlur)
        window.addEventListener("resize", onWindowBlur) // اكتشاف أدوات التسجيل التي تغير الأبعاد
        window.addEventListener("keydown", onKey, { capture: true })

        return () => {
            document.removeEventListener("visibilitychange", onVisibility)
            window.removeEventListener("blur", onWindowBlur)
            window.removeEventListener("resize", onWindowBlur)
            window.removeEventListener("keydown", onKey, { capture: true })
        }
    }, [pauseAny])

    // ══════════════════════════════════════════════════════════════════════════
    // 7. إخفاء أدوات المطور (DevTools detection)
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        let devtoolsOpen = false
        const threshold = 160

        const checkDevTools = () => {
            const widthDiff = window.outerWidth - window.innerWidth > threshold
            const heightDiff = window.outerHeight - window.innerHeight > threshold
            const opened = widthDiff || heightDiff

            if (opened && !devtoolsOpen) {
                devtoolsOpen = true
                pauseAny()
                setIsBlocked(true)
                setBlockReason("تم إيقاف الفيديو. أدوات المطور مفتوحة. أغلقها للمتابعة.")
            } else if (!opened && devtoolsOpen) {
                devtoolsOpen = false
                setIsBlocked(false)
            }
        }

        const interval = setInterval(checkDevTools, 1000)
        return () => clearInterval(interval)
    }, [pauseAny])

    // ══════════════════════════════════════════════════════════════════════════
    // 8. أزرار التحكم
    // ══════════════════════════════════════════════════════════════════════════
    const togglePlay = useCallback(() => {
        if (youtubeId && ytPlayerRef.current) {
            if (isPlaying) ytPlayerRef.current.pauseVideo()
            else ytPlayerRef.current.playVideo()
        } else if (videoRef.current) {
            if (isPlaying) videoRef.current.pause()
            else videoRef.current.play()
        }
    }, [isPlaying, youtubeId])

    const handleSeek = (value: number[]) => {
        const t = value[0]
        if (youtubeId && ytPlayerRef.current) {
            if (typeof ytPlayerRef.current.seekTo === "function") {
                ytPlayerRef.current.seekTo(t, true)
            }
            setCurrentTime(t)
        } else if (videoRef.current) {
            videoRef.current.currentTime = t
            setCurrentTime(t)
        }
    }

    const toggleMute = () => {
        if (youtubeId && ytPlayerRef.current) {
            if (isMuted) ytPlayerRef.current.unMute()
            else ytPlayerRef.current.mute()
        } else if (videoRef.current) {
            videoRef.current.muted = !isMuted
        }
        setIsMuted(!isMuted)
    }

    const handleVolumeChange = (value: number[]) => {
        const v = value[0]
        if (youtubeId && ytPlayerRef.current) ytPlayerRef.current.setVolume(v * 100)
        else if (videoRef.current) {
            videoRef.current.volume = v
            videoRef.current.muted = v === 0
        }
        setVolume(v)
        setIsMuted(v === 0)
    }

    const handlePlaybackRateChange = (rate: number) => {
        if (youtubeId && ytPlayerRef.current) ytPlayerRef.current.setPlaybackRate(rate)
        else if (videoRef.current) videoRef.current.playbackRate = rate
        setPlaybackRate(rate)
    }

    const skip = (sec: number) => {
        if (youtubeId && ytPlayerRef.current) {
            if (typeof ytPlayerRef.current.getCurrentTime === "function" && typeof ytPlayerRef.current.seekTo === "function") {
                const next = (ytPlayerRef.current.getCurrentTime() ?? 0) + sec
                ytPlayerRef.current.seekTo(Math.max(0, next), true)
            }
        } else if (videoRef.current) {
            videoRef.current.currentTime += sec
        }
    }

    const toggleFullscreen = () => {
        if (!containerRef.current) return
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => { })
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const formatTime = (t: number) => {
        const m = Math.floor(t / 60)
        const s = Math.floor(t % 60)
        return `${m}:${s.toString().padStart(2, "0")}`
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return
            switch (e.key.toLowerCase()) {
                case " ": case "k": e.preventDefault(); togglePlay(); break
                case "f": e.preventDefault(); toggleFullscreen(); break
                case "m": e.preventDefault(); toggleMute(); break
                case "j": case "arrowleft": e.preventDefault(); skip(-10); break
                case "l": case "arrowright": e.preventDefault(); skip(10); break
                case "arrowup": e.preventDefault(); handleVolumeChange([Math.min(1, volume + 0.1)]); break
                case "arrowdown": e.preventDefault(); handleVolumeChange([Math.max(0, volume - 0.1)]); break
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [togglePlay, volume])

    // ── Auto-hide controls ────────────────────────────────────────────────────
    useEffect(() => {
        let t: NodeJS.Timeout
        const show = () => {
            setShowControls(true)
            clearTimeout(t)
            t = setTimeout(() => { if (isPlaying) setShowControls(false) }, 3000)
        }
        const el = containerRef.current
        el?.addEventListener("mousemove", show)
        el?.addEventListener("touchstart", show)
        return () => {
            el?.removeEventListener("mousemove", show)
            el?.removeEventListener("touchstart", show)
            clearTimeout(t)
        }
    }, [isPlaying])

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div
            ref={containerRef}
            className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* ── Loading ─────────────────────────────────────────────────── */}
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900 text-white z-50">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm opacity-60">جاري تأمين المحتوى المعرفي...</p>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {!isLoading && error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900 text-white p-6 text-center z-50">
                    <p className="text-sm opacity-80 font-arabic">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="font-arabic">
                        إعادة المحاولة
                    </Button>
                </div>
            )}

            {/* ── YouTube Player ───────────────────────────────────────────── */}
            {youtubeId && !error && (
                <div className="w-full h-full relative">
                    {/* الحاوية الخارجية الثبات يمنع React من محاولة حذف نود استبدله يوتيوب بـ iframe */}
                    <div className="w-full h-full pointer-events-none">
                        <div ref={ytContainerRef} className="w-full h-full" />
                    </div>

                    <div
                        className="absolute inset-0 z-20"
                        style={{
                            pointerEvents: isLoading ? "none" : "all",
                            cursor: isPlaying ? "none" : "default"
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        onClick={togglePlay}
                        onDoubleClick={toggleFullscreen}
                    />
                </div>
            )}

            {/* ── Google Drive iframe ──────────────────────────────────────── */}
            {isDrive && !isLoading && !error && (
                <>
                    <iframe
                        className="w-full h-full"
                        src={(directVideoUrl || "").replace("/view", "/preview")}
                        allow="autoplay"
                        style={{ pointerEvents: "none" }}
                    />
                    <div
                        className="absolute inset-0 z-20"
                        style={{ pointerEvents: "all" }}
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        onClick={togglePlay}
                        onDoubleClick={toggleFullscreen}
                    />
                </>
            )}

            {/* ── Native Video ─────────────────────────────────────────────── */}
            {isNativeVideo && !isLoading && !error && (
                <div className="relative w-full h-full">
                    <video
                        ref={(el) => {
                            // @ts-ignore
                            videoRef.current = el
                            if (el && blobUrl && !srcSetRef.current) {
                                // تعيين المصدر برمجياً ومسحه فوراً من الـ DOM للتمويه
                                if (!el.src || el.src === "") {
                                    el.src = blobUrl
                                    srcSetRef.current = true
                                    // مسح السمة من الـ HTML لكي لا تظهر في الـ Inspect
                                    setTimeout(() => {
                                        if (el) el.removeAttribute("src")
                                    }, 100)
                                }
                            }
                        }}
                        className={`w-full h-full object-contain transition-all duration-75 ${isBlocked ? "opacity-0 blur-3xl scale-110 pointer-events-none" : "opacity-100"}`}
                        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
                        onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onClick={togglePlay}
                        onDoubleClick={toggleFullscreen}
                        controlsList="nodownload nofullscreen noremoteplayback"
                        disablePictureInPicture
                        playsInline
                        onContextMenu={(e) => e.preventDefault()}
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
             *  Anti-Capture Blocking Overlay (يعمل على جميع أنواع الفيديو)
             * ══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {isBlocked && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
                        style={{ pointerEvents: "all" }}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <div className="bg-destructive/10 text-destructive h-20 w-20 rounded-full flex items-center justify-center mb-4 border border-destructive/20 animate-pulse">
                            <ShieldAlert className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 font-arabic">محتوى محمي آمن</h3>
                        <p className="max-w-md text-sm text-zinc-300 font-arabic leading-relaxed">{blockReason}</p>
                        <Button
                            variant="outline"
                            className="mt-6 border-white/20 text-white hover:bg-white/10 font-arabic"
                            onClick={() => setIsBlocked(false)}
                        >
                            فهمت ذلك، العودة للدرس
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════════════════════════════
             *  Custom Controls Overlay
             *  (تظهر فوق الـ Protective Overlay لذا z-index أعلى)
             * ══════════════════════════════════════════════════════════════ */}
            {!isLoading && !error && (
                <AnimatePresence>
                    {showControls && !isBlocked && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-end p-4 gap-2 z-30"
                            style={{ pointerEvents: "none" }}
                        >
                            {/* Center Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                {!isPlaying && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="h-16 w-16 bg-primary/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30"
                                    >
                                        <Play className="h-8 w-8 text-white fill-white ml-1" />
                                    </motion.div>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full" style={{ pointerEvents: "all" }}>
                                <Slider
                                    value={[currentTime]}
                                    max={duration || 100}
                                    step={0.1}
                                    onValueChange={handleSeek}
                                    className="cursor-pointer"
                                />
                            </div>

                            {/* Bottom Controls */}
                            <div className="flex items-center justify-between gap-4" style={{ pointerEvents: "all" }}>
                                {/* Left controls */}
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={togglePlay}>
                                        {isPlaying
                                            ? <Pause className="h-5 w-5 fill-current" />
                                            : <Play className="h-5 w-5 fill-current ml-0.5" />}
                                    </Button>

                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => skip(-10)}>
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => skip(10)}>
                                        <RotateCw className="h-4 w-4" />
                                    </Button>

                                    <div className="flex items-center group/volume ml-2">
                                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={toggleMute}>
                                            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                        </Button>
                                        <div className="w-0 group-hover/volume:w-20 transition-all duration-300 overflow-hidden ml-1">
                                            <Slider
                                                value={[isMuted ? 0 : volume]}
                                                max={1}
                                                step={0.01}
                                                onValueChange={handleVolumeChange}
                                                className="w-20"
                                            />
                                        </div>
                                    </div>

                                    <span className="text-[10px] text-white/80 font-mono hidden sm:inline-block">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </span>
                                </div>

                                {/* Right controls */}
                                <div className="flex items-center gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-8 gap-1 px-2">
                                                <Settings className="h-4 w-4" />
                                                <span className="text-xs">{playbackRate}x</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
                                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                                <DropdownMenuItem
                                                    key={rate}
                                                    onClick={() => handlePlaybackRateChange(rate)}
                                                    className={`hover:bg-white/10 ${playbackRate === rate ? "bg-primary/20 text-primary" : ""}`}
                                                >
                                                    {rate}x
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={toggleFullscreen}>
                                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* ══════════════════════════════════════════════════════════════
             *  Watermark – متحرك + ثابت (z-index 100 فوق كل شيء عدا الـ blocking overlay)
             * ══════════════════════════════════════════════════════════════ */}
            {!isLoading && !error && (
                <>
                    {/* Watermark متحرك بطيء جداً في الاتجاهات الأربعة */}
                    <motion.div
                        initial={false}
                        animate={{
                            left: ["5%", "50%", "95%", "95%", "95%", "50%", "5%", "5%", "5%"],
                            top: ["5%", "5%", "5%", "50%", "95%", "95%", "95%", "50%", "5%"],
                        }}
                        transition={{
                            duration: 120, // أبطأ بكثير (دقيقتين لكل دورة)
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute pointer-events-none z-[100] select-none"
                    >
                        <div className="bg-black/5 backdrop-blur-[1px] px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold text-white/[0.08] border border-white/[0.03] whitespace-nowrap -rotate-12 flex flex-col items-center shadow-lg">
                            <span className="tracking-tighter select-none">{userEmail}</span>
                            <span className="opacity-40 text-[7px] md:text-[8px] select-none font-mono">ID: {studentId}</span>
                        </div>
                    </motion.div>

                    {/* Watermark ثابت خافت */}
                    <div className="absolute inset-0 pointer-events-none z-[90] select-none overflow-hidden opacity-[0.025]">
                        <div className="absolute top-[10%] left-[10%] -rotate-45 text-white font-black text-4xl whitespace-nowrap">MANARA ACADEMY</div>
                        <div className="absolute bottom-[20%] right-[10%] -rotate-45 text-white font-black text-4xl whitespace-nowrap">MANARA ACADEMY</div>
                        <div className="absolute top-[45%] left-[35%] -rotate-45 text-white font-black text-2xl whitespace-nowrap opacity-70">{userEmail}</div>
                    </div>
                </>
            )}
        </div>
    )
}
