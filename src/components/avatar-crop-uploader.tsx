"use client"

import { useState, useRef, useEffect } from "react"
import { Camera, ZoomIn, ZoomOut, RotateCcw, Check, Loader2, User, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { auth, db } from "@/lib/firebase/config"
import { doc, updateDoc } from "firebase/firestore"

interface AvatarCropUploaderProps {
    currentAvatarUrl?: string | null
    onAvatarUpdated?: (newUrl: string) => void
    label?: string
}

export function AvatarCropUploader({
    currentAvatarUrl,
    onAvatarUpdated,
    label = "تغيير الصورة الشخصية"
}: AvatarCropUploaderProps) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    
    // Crop & Zoom State
    const [zoom, setZoom] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (currentAvatarUrl !== undefined) {
            setAvatarUrl(currentAvatarUrl)
        }
    }, [currentAvatarUrl])

    // 1. Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith("image/")) {
            toast.error("يرجى اختيار ملف صورة صالح (JPG أو PNG أو WebP)")
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("حجم الصورة كبير جداً. الحد الأقصى هو 10 ميجابايت")
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            const testImg = new Image()
            testImg.onload = () => {
                setImgSize({
                    width: testImg.naturalWidth || testImg.width || 300,
                    height: testImg.naturalHeight || testImg.height || 300
                })
                setSelectedImage(result)
                setZoom(1)
                setOffset({ x: 0, y: 0 })
                setIsDialogOpen(true)
            }
            testImg.src = result

            // Reset input so same file can be picked again if desired
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
        reader.readAsDataURL(file)
    }

    // 2. Mouse/Touch Drag for repositioning
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true)
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true)
            setDragStart({
                x: e.touches[0].clientX - offset.x,
                y: e.touches[0].clientY - offset.y
            })
        }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return
        setOffset({
            x: e.touches[0].clientX - dragStart.x,
            y: e.touches[0].clientY - dragStart.y
        })
    }

    const handleTouchEnd = () => {
        setIsDragging(false)
    }

    // 3. Render Image & Exact Crop on Canvas, then Upload
    const handleCropAndSave = async () => {
        if (!selectedImage) return
        setIsSaving(true)

        try {
            const user = auth.currentUser
            if (!user) {
                toast.error("يرجى تسجيل الدخول أولاً")
                setIsSaving(false)
                return
            }

            const OUTPUT_SIZE = 512
            const PREVIEW_SIZE = 260

            // Create offscreen canvas 512x512
            const cropCanvas = document.createElement("canvas")
            cropCanvas.width = OUTPUT_SIZE
            cropCanvas.height = OUTPUT_SIZE
            const ctx = cropCanvas.getContext("2d")

            if (!ctx) {
                throw new Error("تعذر إنشاء مساحة معالجة الصورة")
            }

            const img = new Image()
            img.crossOrigin = "anonymous"
            await new Promise((resolve, reject) => {
                img.onload = resolve
                img.onerror = reject
                img.src = selectedImage
            })

            const natW = img.naturalWidth || img.width || imgSize.width || 300
            const natH = img.naturalHeight || img.height || imgSize.height || 300

            // Calculate base scale so image fits / covers the 260 preview circle
            const baseScale = Math.max(PREVIEW_SIZE / natW, PREVIEW_SIZE / natH)
            const baseW = natW * baseScale
            const baseH = natH * baseScale

            // Dimensions inside the 260 preview circle at current zoom
            const currentW = baseW * zoom
            const currentH = baseH * zoom

            // Top-left coordinates of the image inside the 260x260 circle
            const circleCenter = PREVIEW_SIZE / 2 // 130
            const imgLeft = (circleCenter + offset.x) - (currentW / 2)
            const imgTop = (circleCenter + offset.y) - (currentH / 2)

            // Exact scale ratio to project preview coordinates onto 512x512 canvas
            const scaleRatio = OUTPUT_SIZE / PREVIEW_SIZE
            const drawX = imgLeft * scaleRatio
            const drawY = imgTop * scaleRatio
            const drawW = currentW * scaleRatio
            const drawH = currentH * scaleRatio

            // Clip circle and draw image
            ctx.save()
            ctx.beginPath()
            ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(img, drawX, drawY, drawW, drawH)
            ctx.restore()

            // Convert canvas to Blob (WebP 92% quality)
            const blob: Blob = await new Promise((resolve, reject) => {
                cropCanvas.toBlob((b) => {
                    if (b) resolve(b)
                    else reject(new Error("تعذر تصدير الصورة"))
                }, "image/webp", 0.92)
            })

            // Upload directly to unified Supabase storage endpoint
            const fileName = `avatar_${user.uid}_${Date.now()}.webp`
            const uploadUrl = `/api/upload/supabase?fileName=${encodeURIComponent(fileName)}&folder=avatars`

            const uploadRes = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "image/webp",
                },
                body: blob,
            })

            const uploadData = await uploadRes.json().catch(() => ({}))
            if (!uploadRes.ok || !uploadData.url) {
                throw new Error(uploadData.error || "فشل رفع الصورة إلى مساحة التخزين")
            }

            const publicAvatarUrl = uploadData.url

            // Update user profile in Firestore
            try {
                await updateDoc(doc(db, "profiles", user.uid), {
                    avatar_url: publicAvatarUrl,
                    updated_at: new Date().toISOString(),
                })
            } catch (fsErr) {
                // Fallback to API endpoint
                await fetch("/api/profile/me", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ avatar_url: publicAvatarUrl }),
                })
            }

            setAvatarUrl(publicAvatarUrl)
            onAvatarUpdated?.(publicAvatarUrl)
            setIsDialogOpen(false)
            setSelectedImage(null)
            toast.success("تم قص وتحديث صورتك الشخصية بنجاح! 🎉")
        } catch (error: any) {
            console.error("Avatar save error:", error)
            toast.error(error.message || "حدث خطأ أثناء حفظ الصورة")
        } finally {
            setIsSaving(false)
        }
    }

    // Dynamic dimensions for the preview image
    const PREVIEW_SIZE = 260
    const baseScale = (imgSize.width > 0 && imgSize.height > 0)
        ? Math.max(PREVIEW_SIZE / imgSize.width, PREVIEW_SIZE / imgSize.height)
        : 1
    const renderWidth = (imgSize.width || PREVIEW_SIZE) * baseScale
    const renderHeight = (imgSize.height || PREVIEW_SIZE) * baseScale

    return (
        <div className="flex flex-col items-center gap-3 font-arabic">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
            />

            {/* Avatar Preview & Action */}
            <div className="relative group">
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 w-32 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted flex items-center justify-center cursor-pointer transition-transform duration-300 group-hover:scale-105 relative"
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <User className="h-14 w-14 text-muted-foreground/60" />
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 backdrop-blur-2xs">
                        <Camera className="h-6 w-6" />
                        <span className="text-[11px] font-bold">تغيير الصورة</span>
                    </div>
                </div>

                {/* Edit Badge Button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 left-1 h-9 w-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center shadow-lg border-2 border-background transition-transform active:scale-95"
                    title={label}
                >
                    <Camera className="h-4 w-4" />
                </button>
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full text-xs font-bold gap-1.5 h-8 px-4 border-muted-foreground/30 hover:border-primary hover:text-primary transition-all"
            >
                <Camera className="h-3.5 w-3.5" />
                <span>{label}</span>
            </Button>

            {/* Interactive Crop Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => !isSaving && setIsDialogOpen(open)}>
                <DialogContent className="sm:max-w-md font-arabic p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            قص وضبط الصورة الشخصية
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            اسحب الصورة لتحديد الموضع المناسب واستخدم شريط التكبير لضبط حجمها داخل الإطار بدقة.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Interactive Canvas / Preview Box */}
                    <div className="flex flex-col items-center py-4 space-y-4">
                        <div
                            className="relative w-[260px] h-[260px] rounded-full overflow-hidden border-4 border-primary shadow-2xl bg-zinc-950 cursor-grab active:cursor-grabbing select-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            {selectedImage && (
                                <img
                                    src={selectedImage}
                                    alt="Crop target"
                                    draggable={false}
                                    className="max-w-none pointer-events-none select-none"
                                    style={{
                                        position: "absolute",
                                        top: "50%",
                                        left: "50%",
                                        width: `${renderWidth}px`,
                                        height: `${renderHeight}px`,
                                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                        transformOrigin: "center center",
                                    }}
                                />
                            )}

                            {/* Circular Mask Helper Ring */}
                            <div className="absolute inset-0 rounded-full border-2 border-white/40 pointer-events-none shadow-inner"></div>
                        </div>

                        {/* Zoom Controls */}
                        <div className="w-full max-w-[280px] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <ZoomOut className="h-3.5 w-3.5" /> تصغير
                                </span>
                                <span>تكبير: {Math.round(zoom * 100)}%</span>
                                <span className="flex items-center gap-1">
                                    <ZoomIn className="h-3.5 w-3.5" /> تكبير
                                </span>
                            </div>

                            <input
                                type="range"
                                min="0.6"
                                max="3"
                                step="0.05"
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Reset Position Button */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setZoom(1)
                                setOffset({ x: 0, y: 0 })
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-7"
                        >
                            <RotateCcw className="h-3 w-3" />
                            إعادة ضبط الموضع
                        </Button>
                    </div>

                    <DialogFooter className="flex-row sm:justify-end gap-2 pt-2 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isSaving}
                            className="rounded-xl flex-1 sm:flex-none"
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCropAndSave}
                            disabled={isSaving}
                            className="rounded-xl gap-2 font-bold px-6 flex-1 sm:flex-none shadow-md"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>جاري المعالجة والحفظ...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>حفظ وتعيين الصورة</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
