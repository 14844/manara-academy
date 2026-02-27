"use client"

import { useState, useRef } from "react"
import { Upload, X, CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

interface FileUploaderProps {
    onUploadComplete: (url: string) => void
    accept?: string
    maxSizeMB?: number
    validateDimensions?: { width: number; height: number }
    label?: string
    folder?: string
}

export function FileUploader({
    onUploadComplete,
    accept = "video/*,image/*",
    maxSizeMB = 500,
    validateDimensions,
    label = "رفع ملف",
    folder = "general"
}: FileUploaderProps) {
    console.log("FileUploader initialized for Bunny.net. Path:", folder)
    const [file, setFile] = useState<File | null>(null)
    const [progress, setProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const validateImage = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!validateDimensions || !file.type.startsWith('image/')) {
                resolve(true)
                return
            }

            const img = new Image()
            img.onload = () => {
                URL.revokeObjectURL(img.src)
                if (img.width !== validateDimensions.width || img.height !== validateDimensions.height) {
                    toast.error(`يجب أن تكون أبعاد الصورة ${validateDimensions.width}x${validateDimensions.height}`)
                    resolve(false)
                } else {
                    resolve(true)
                }
            }
            img.onerror = () => resolve(false)
            img.src = URL.createObjectURL(file)
        })
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        // 1. Check size
        if (selectedFile.size > maxSizeMB * 1024 * 1024) {
            toast.error(`حجم الملف كبير جداً. الحد الأقصى هو ${maxSizeMB} ميجابايت`)
            return
        }

        // 2. Validate dimensions if image
        if (validateDimensions) {
            const isValid = await validateImage(selectedFile)
            if (!isValid) return
        }

        setFile(selectedFile)
        setIsComplete(false)
        setProgress(0)
    }

    const startUpload = () => {
        if (!file) {
            toast.error("يرجى اختيار ملف أولاً")
            return
        }

        setIsUploading(true)
        setProgress(0)

        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const fileName = `${Date.now()}_${sanitizedName}`

        const xhr = new XMLHttpRequest()

        // Use searchParams to pass metadata to the API route
        const uploadUrl = `/api/upload/bunny?fileName=${encodeURIComponent(fileName)}&folder=${encodeURIComponent(folder)}`

        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100
                setProgress(percentComplete)
            }
        }

        xhr.onload = () => {
            setIsUploading(false)
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText)
                    if (response.success) {
                        setIsComplete(true)
                        onUploadComplete(response.url)
                        toast.success("تم الرفع بنجاح إلى Bunny.net")
                    } else {
                        toast.error(`فشل الرفع: ${response.error}`)
                    }
                } catch (e) {
                    toast.error("خطأ في قراءة استجابة السيرفر")
                }
            } else {
                toast.error(`فشل الرفع: خطأ ${xhr.status}`)
            }
        }

        xhr.onerror = () => {
            setIsUploading(false)
            toast.error("حدث خطأ في الاتصال أثناء الرفع")
        }

        xhr.send(file)
    }

    return (
        <div className="space-y-4 font-arabic">
            {!file ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-bold">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        {accept.includes('video') ? "MP4, MOV (بحد أقصى ٥٠٠ ميجابايت)" : "JPG, PNG (بحد أقصى ٥ ميجابايت)"}
                    </p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept={accept}
                        onChange={handleFileChange}
                    />
                </div>
            ) : (
                <div className="border rounded-xl p-4 bg-muted/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                {isComplete ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <Upload className="h-6 w-6 text-primary" />}
                            </div>
                            <div className="max-w-[150px] md:max-w-xs">
                                <p className="text-sm font-bold truncate">{file.name}</p>
                                <p className="text-[10px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                        </div>
                        {!isUploading && !isComplete && (
                            <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {isUploading && (
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <div className="flex justify-between text-[10px] font-bold">
                                <span>جارِ الرفع...</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                        </div>
                    )}

                    {!isUploading && !isComplete && (
                        <Button className="w-full gap-2" onClick={startUpload}>
                            بدء الرفع للسيرفر
                        </Button>
                    )}

                    {isComplete && (
                        <div className="flex items-center gap-2 text-xs text-green-600 font-bold bg-green-50 p-2 rounded-lg">
                            <CheckCircle2 className="h-4 w-4" />
                            تم حفظ الملف بنجاح
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
