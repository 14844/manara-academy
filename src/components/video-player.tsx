"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Volume2, Maximize, Settings, SkipForward, SkipBack } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

interface VideoPlayerProps {
    src: string
    studentName: string
}

export function SecuredVideoPlayer({ src, studentName }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [volume, setVolume] = useState(80)

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause()
            else videoRef.current.play()
            setIsPlaying(!isPlaying)
        }
    }

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = (videoRef.current.currentTime / videoRef.current.duration) * 100
            setProgress(current)
        }
    }

    const handleSliderChange = (value: number[]) => {
        if (videoRef.current) {
            const time = (value[0] / 100) * videoRef.current.duration
            videoRef.current.currentTime = time
            setProgress(value[0])
        }
    }

    // Multi-login prevention & Right-click prevention
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => e.preventDefault()
        document.addEventListener("contextmenu", handleContextMenu)
        return () => document.removeEventListener("contextmenu", handleContextMenu)
    }, [])

    return (
        <div className="relative group overflow-hidden bg-black rounded-xl border border-white/10 shadow-2xl aspect-video">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 select-none">
                <span className="text-white text-3xl font-extrabold rotate-[-30deg] whitespace-nowrap uppercase tracking-widest">
                    {studentName} • {studentName} • {studentName}
                </span>
            </div>

            {/* Controls Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity opacity-0 group-hover:opacity-100 space-y-4">
                <Slider
                    value={[progress]}
                    max={100}
                    step={0.1}
                    onValueChange={handleSliderChange}
                    className="cursor-pointer"
                />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={togglePlay}>
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                        </Button>
                        <div className="flex items-center gap-2 group/volume w-24">
                            <Volume2 className="h-5 w-5 text-white" />
                            <Slider
                                value={[volume]}
                                max={100}
                                onValueChange={(v) => {
                                    setVolume(v[0])
                                    if (videoRef.current) videoRef.current.volume = v[0] / 100
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => videoRef.current?.requestFullscreen()}>
                            <Maximize className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
