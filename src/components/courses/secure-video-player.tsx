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
    FastForward,
    ShieldAlert,
    AlertCircle
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
import { toast } from "sonner"
import { db } from "@/lib/firebase/config"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

interface SecureVideoPlayerProps {
    courseId: string
    lessonId: string
    videoPath?: string
    userEmail?: string
    studentId?: string
    startTime?: number
}

export function SecureVideoPlayer({ courseId, lessonId, videoPath, userEmail, studentId, startTime = 0 }: SecureVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [videoUrl, setVideoUrl] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isBlocked, setIsBlocked] = useState(false)
    const [blockReason, setBlockReason] = useState("")
    const [lastSavedTime, setLastSavedTime] = useState(0)
    const [isInitialized, setIsInitialized] = useState(false)

    // Watermark state


    // 1. Fetch Signed URL
    useEffect(() => {
        async function getSignedUrl() {
            if (!videoPath) {
                setError("لا يوجد فيديو متاح لهذا الدرس")
                setIsLoading(false)
                return
            }

            if (videoPath.startsWith('http')) {
                setVideoUrl(videoPath)
                setIsLoading(false)
                return
            }

            try {
                setIsLoading(true)
                const response = await fetch(`/api/video/sign?path=${encodeURIComponent(videoPath)}`)
                const data = await response.json()

                if (data.url) {
                    setVideoUrl(data.url)
                } else {
                    throw new Error("Failed to get signed URL")
                }
            } catch (err) {
                console.error("Signed URL error:", err)
                setError("فشل تحميل الفيديو. يرجى المحاولة لاحقاً.")
            } finally {
                setIsLoading(false)
            }
        }

        getSignedUrl()
    }, [videoPath])

    // 1.5 Handle Initial Time (Resume)
    useEffect(() => {
        if (videoRef.current && startTime > 0 && !isInitialized && !isLoading) {
            videoRef.current.currentTime = startTime
            setCurrentTime(startTime)
            setIsInitialized(true)
        }
    }, [startTime, isLoading, isInitialized])

    // 1.6 Progress Saving Logic
    useEffect(() => {
        if (!studentId || !lessonId || !isPlaying) return

        const saveProgress = async () => {
            if (Math.abs(currentTime - lastSavedTime) < 10) return // Save every 10 seconds

            try {
                const progressRef = doc(db, "video_progress", `${studentId}_${lessonId}`)
                await setDoc(progressRef, {
                    student_id: studentId,
                    course_id: courseId,
                    lesson_id: lessonId,
                    current_time: currentTime,
                    duration: duration,
                    updated_at: serverTimestamp(),
                }, { merge: true })
                setLastSavedTime(currentTime)
            } catch (error) {
                console.error("Error saving video progress:", error)
            }
        }

        const timeout = setTimeout(saveProgress, 1000)
        return () => clearTimeout(timeout)
    }, [currentTime, isPlaying, studentId, lessonId, courseId, lastSavedTime, duration])

    // 2. Watermark Movement


    // 3. Controls Logic
    const togglePlay = useCallback(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause()
            } else {
                videoRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }, [isPlaying])

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime)
        }
    }

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration)
        }
    }

    const handleSeek = (value: number[]) => {
        if (videoRef.current) {
            videoRef.current.currentTime = value[0]
            setCurrentTime(value[0])
        }
    }

    const toggleMute = () => {
        if (videoRef.current) {
            const newMuted = !isMuted
            videoRef.current.muted = newMuted
            setIsMuted(newMuted)
        }
    }

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0]
        if (videoRef.current) {
            videoRef.current.volume = newVolume
            setVolume(newVolume)
            setIsMuted(newVolume === 0)
            videoRef.current.muted = newVolume === 0
        }
    }

    const handlePlaybackRateChange = (rate: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = rate
            setPlaybackRate(rate)
        }
    }

    const toggleFullscreen = () => {
        if (!containerRef.current) return

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`)
            })
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const skip = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime += seconds
        }
    }

    // Format time
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    // 3. Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if no input is focused
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault()
                    togglePlay()
                    break
                case 'f':
                    e.preventDefault()
                    toggleFullscreen()
                    break
                case 'm':
                    e.preventDefault()
                    toggleMute()
                    break
                case 'j':
                case 'arrowleft':
                    e.preventDefault()
                    skip(-10)
                    break
                case 'l':
                case 'arrowright':
                    e.preventDefault()
                    skip(10)
                    break
                case 'arrowup':
                    e.preventDefault()
                    handleVolumeChange([Math.min(1, volume + 0.1)])
                    break
                case 'arrowdown':
                    e.preventDefault()
                    handleVolumeChange([Math.max(0, volume - 0.1)])
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [togglePlay, toggleFullscreen, toggleMute, volume, skip])

    // 4. Hide controls on inactivity
    useEffect(() => {
        let timeout: NodeJS.Timeout
        const handleMouseMove = () => {
            setShowControls(true)
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                if (isPlaying) setShowControls(false)
            }, 3000)
        }

        const container = containerRef.current
        if (container) {
            container.addEventListener('mousemove', handleMouseMove)
            container.addEventListener('touchstart', handleMouseMove)
        }

        return () => {
            if (container) {
                container.removeEventListener('mousemove', handleMouseMove)
                container.removeEventListener('touchstart', handleMouseMove)
            }
            clearTimeout(timeout)
        }
    }, [isPlaying])

    // 5. Advanced Anti-Capture Logic
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                if (isPlaying) videoRef.current?.pause()
                setIsBlocked(true)
                setBlockReason("تم إيقاف الفيديو لأنك غادرت الصفحة. المحتوى محمي.")
            } else {
                setIsBlocked(false)
            }
        }

        const handleBlur = () => {
            if (isPlaying) videoRef.current?.pause()
            setIsBlocked(true)
            setBlockReason("المحتوى محمي. يرجى التركيز على نافذة الفيديو لمنع تسجيل الشاشة.")
        }

        const handleFocus = () => {
            setIsBlocked(false)
        }

        const handleKeyCombo = (e: KeyboardEvent) => {
            // Detect Windows+Shift+S, Cmd+Shift+4, or PrintScreen
            const isWinShiftS = e.key === 'S' && e.shiftKey && (e.metaKey || e.ctrlKey)
            const isMacShift4 = e.key === '4' && e.shiftKey && e.metaKey
            const isPrintScreen = e.key === 'PrintScreen'
            // Trigger on ANY start of system shortcut
            const isSystemKey = e.key === 'Meta' || e.key === 'OS'

            if (isWinShiftS || isMacShift4 || isPrintScreen || isSystemKey) {
                // Triggered on keydown - BEFORE the OS can snip
                setIsBlocked(true)
                setBlockReason("تم حجب المحتوى وقائياً بسبب استخدام مفاتيح نظام التشغيل. المحتوى محمي.")
                if (isPlaying) videoRef.current?.pause()
            }
        }

        // Attempt to detect web-based screen sharing
        const detectDisplayMedia = () => {
            if (navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia) {
                const originalGetDisplayMedia = (navigator.mediaDevices as any).getDisplayMedia
                    ; (navigator.mediaDevices as any).getDisplayMedia = async (options: any) => {
                        setIsBlocked(true)
                        setBlockReason("مشاركة الشاشة غير مسموح بها أثناء عرض الدروس.")
                        if (isPlaying) videoRef.current?.pause()
                        throw new Error("Screen sharing blocked by security policy")
                    }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('blur', handleBlur)
        window.addEventListener('focus', handleFocus)
        window.addEventListener('keydown', handleKeyCombo)
        detectDisplayMedia()

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('blur', handleBlur)
            window.removeEventListener('focus', handleFocus)
            window.removeEventListener('keydown', handleKeyCombo)
        }
    }, [isPlaying])

    // Detect YouTube/Drive iframes
    const youtubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
        const match = url.match(regExp)
        return (match && match[2].length === 11) ? match[2] : null
    }
    const currentYoutubeId = youtubeId(videoUrl)
    const isIframe = videoUrl.includes('drive.google.com') || currentYoutubeId

    return (
        <div
            ref={containerRef}
            className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group select-none"
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={() => {
                if (isPlaying) {
                    setIsBlocked(true)
                    setBlockReason("تم التشويش وقائياً. يرجى إبقاء المؤشر داخل منطقة الفيديو.")
                }
            }}
            onMouseEnter={() => setIsBlocked(false)}
        >
            {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900 text-white">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm opacity-60">جاري تأمين المحتوى المعرفي...</p>
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900 text-white p-6 text-center">
                    <p className="text-sm opacity-80 font-arabic">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="font-arabic">إعادة المحاولة</Button>
                </div>
            ) : (
                <>
                    {currentYoutubeId ? (
                        <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${currentYoutubeId}?rel=0&modestbranding=1`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    ) : videoUrl.includes('drive.google.com') ? (
                        <iframe
                            className="w-full h-full"
                            src={videoUrl.replace('/view', '/preview')}
                            allow="autoplay"
                        ></iframe>
                    ) : (
                        <div className="relative w-full h-full">
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                className={`w-full h-full object-contain transition-all duration-75 ${isBlocked ? "opacity-0 blur-3xl scale-110 pointer-events-none" : "opacity-100"}`}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onClick={togglePlay}
                                controlsList="nodownload nofullscreen noremoteplayback"
                                disablePictureInPicture
                                playsInline
                                onContextMenu={(e) => e.preventDefault()}
                            />

                            {/* Blocking Overlay */}
                            <AnimatePresence>
                                {isBlocked && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                                    >
                                        <div className="bg-destructive/10 text-destructive h-20 w-20 rounded-full flex items-center justify-center mb-4 border border-destructive/20 animate-pulse">
                                            <ShieldAlert className="h-10 w-10" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2 font-arabic">محتوى محمي آمن</h3>
                                        <p className="max-w-md text-sm text-zinc-300 font-arabic leading-relaxed leading-arabic">
                                            {blockReason}
                                        </p>
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

                            {/* Custom Controls Overlay */}
                            <AnimatePresence>
                                {showControls && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-end p-4 gap-2"
                                    >
                                        {/* Center Play Button Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <motion.button
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="h-16 w-16 bg-primary/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20"
                                            >
                                                {isPlaying ? <Pause className="h-8 w-8 text-white fill-white" /> : <Play className="h-8 w-8 text-white fill-white ml-1" />}
                                            </motion.button>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full group/progress">
                                            <Slider
                                                value={[currentTime]}
                                                max={duration}
                                                step={0.1}
                                                onValueChange={handleSeek}
                                                className="cursor-pointer"
                                            />
                                        </div>

                                        {/* Bottom Controls */}
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={togglePlay}>
                                                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                                                </Button>

                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => skip(-10)}>
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => skip(10)}>
                                                        <RotateCw className="h-4 w-4" />
                                                    </Button>
                                                </div>

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

                                            <div className="flex items-center gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-8 gap-1 px-2">
                                                            <Settings className="h-4 w-4" />
                                                            <span className="text-xs">{playbackRate}x</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
                                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
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
                        </div>
                    )}

                    {/* Dynamic Moving Watermark */}
                    <motion.div
                        initial={false}
                        animate={{
                            top: ["10%", "10%", "80%", "80%", "10%"],
                            left: ["10%", "80%", "80%", "10%", "10%"]
                        }}
                        transition={{
                            duration: 30,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute pointer-events-none z-50 select-none"
                    >
                        <div className="bg-black/5 backdrop-blur-[1px] px-2 py-1 rounded text-[10px] md:text-xs font-bold text-white/30 border border-white/5 whitespace-nowrap -rotate-12 flex flex-col items-center">
                            <span>{userEmail}</span>
                            <span className="opacity-60">{studentId}</span>
                        </div>
                    </motion.div>

                    {/* Background Static Faint Watermarks */}
                    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden opacity-[0.03]">
                        <div className="absolute top-[10%] left-[10%] -rotate-45 text-white font-black text-4xl whitespace-nowrap">MANARA ACADEMY</div>
                        <div className="absolute bottom-[20%] right-[10%] -rotate-45 text-white font-black text-4xl whitespace-nowrap">MANARA ACADEMY</div>
                    </div>
                </>
            )}
        </div>
    )
}
