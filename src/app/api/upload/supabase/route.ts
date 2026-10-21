import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, SUPABASE_BUCKET, SUPABASE_PUBLIC_BUCKET } from "@/lib/supabase/admin"
import { getServerAuth } from "@/lib/server-auth"
import { adminDb } from "@/lib/firebase/admin"

export const runtime = 'nodejs'

// Maximum file size limits per folder
const SIZE_LIMITS: Record<string, number> = {
    avatars: 5 * 1024 * 1024,         // 5MB
    payment_proofs: 5 * 1024 * 1024,  // 5MB
    thumbnails: 10 * 1024 * 1024,     // 10MB
    questions: 10 * 1024 * 1024,      // 10MB
    files: 100 * 1024 * 1024,         // 100MB
    videos: 1024 * 1024 * 1024,       // 1GB
}

// Allowed MIME types per folder
const ALLOWED_TYPES: Record<string, string[]> = {
    avatars: ["image/jpeg", "image/png", "image/webp"],
    payment_proofs: ["image/jpeg", "image/png", "image/webp"],
    thumbnails: ["image/jpeg", "image/png", "image/webp"],
    questions: ["image/jpeg", "image/png", "image/webp"],
    files: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    videos: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
}

export async function POST(request: NextRequest) {
    const user = await getServerAuth(request)
    if (!user) {
        return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 })
    }
    if (user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "الحساب موقوف، لا يمكنك رفع ملفات" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawFileName = searchParams.get('fileName') || 'upload'
    const rawFolder = (searchParams.get('folder') || 'files').toLowerCase()
    const contentType = request.headers.get('content-type') || 'application/octet-stream'

    // Validate folder
    const validFolders = ["avatars", "payment_proofs", "thumbnails", "questions", "files", "videos"]
    if (!validFolders.includes(rawFolder)) {
        return NextResponse.json({ error: "مجلد الرفع غير صالح أو غير مصرح به" }, { status: 400 })
    }

    // Role-based permissions matrix
    if (user.role === "student") {
        // Students are strictly limited to payment proofs and avatars
        if (rawFolder !== "avatars" && rawFolder !== "payment_proofs") {
            return NextResponse.json({ 
                error: "غير مصرح للطلاب برفع الملفات في هذا القسم (مسموح فقط برفع الصور الشخصية وإيصالات الشحن)" 
            }, { status: 403 })
        }
    } else if (user.role === "instructor") {
        // Instructors can upload course materials, videos, thumbnails, questions, avatars (not payment proofs)
        if (rawFolder === "payment_proofs") {
            return NextResponse.json({ 
                error: "إيصالات الشحن مخصصة للطلاب فقط" 
            }, { status: 403 })
        }
    }

    // Sanitize file name and prevent path traversal
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    if (!cleanFileName || cleanFileName.includes('..')) {
        return NextResponse.json({ error: "اسم الملف غير صالح" }, { status: 400 })
    }

    // Validate MIME type
    const allowedMimes = ALLOWED_TYPES[rawFolder] || []
    const isAllowedMime = allowedMimes.some(mime => contentType.startsWith(mime) || contentType === mime)
    if (!isAllowedMime) {
        return NextResponse.json({ 
            error: `نوع الملف (${contentType}) غير مدعوم في مجلد ${rawFolder}` 
        }, { status: 400 })
    }

    // Validate content length
    const contentLength = Number(request.headers.get('content-length') || 0)
    const maxLimit = SIZE_LIMITS[rawFolder] || (10 * 1024 * 1024)
    if (contentLength > maxLimit) {
        const mb = Math.round(maxLimit / (1024 * 1024))
        return NextResponse.json({ 
            error: `حجم الملف يتجاوز الحد الأقصى المسموح به لهذا القسم (${mb} ميجابايت)` 
        }, { status: 400 })
    }

    // Build isolated storage path
    const timestamp = Date.now()
    const courseId = searchParams.get('courseId')
    let storagePath = ""

    if (rawFolder === "avatars") {
        storagePath = `avatars/avatar_${user.uid}_${timestamp}_${cleanFileName}`
    } else if (rawFolder === "payment_proofs") {
        storagePath = `payment_proofs/proof_${user.uid}_${timestamp}_${cleanFileName}`
    } else if (rawFolder === "thumbnails") {
        storagePath = courseId 
            ? `thumbnails/course_${courseId}_${timestamp}_${cleanFileName}`
            : `thumbnails/thumb_${user.uid}_${timestamp}_${cleanFileName}`
    } else if (rawFolder === "questions") {
        storagePath = `questions/q_${user.uid}_${timestamp}_${cleanFileName}`
    } else if (rawFolder === "videos") {
        storagePath = courseId
            ? `videos/courses/${courseId}/${timestamp}_${cleanFileName}`
            : `videos/instructor_${user.uid}/${timestamp}_${cleanFileName}`
    } else {
        // files (PDFs, docs)
        storagePath = courseId
            ? `files/courses/${courseId}/${timestamp}_${cleanFileName}`
            : `files/instructor_${user.uid}/${timestamp}_${cleanFileName}`
    }

    try {
        const fileBuffer = await request.arrayBuffer()
        if (fileBuffer.byteLength === 0) {
            return NextResponse.json({ error: "الملف فارغ" }, { status: 400 })
        }
        if (fileBuffer.byteLength > maxLimit) {
            const mb = Math.round(maxLimit / (1024 * 1024))
            return NextResponse.json({ error: `حجم الملف يتجاوز ${mb} ميجابايت` }, { status: 400 })
        }

        // Always upload to the unified main bucket (manara-academy)
        const isAvatar = rawFolder === "avatars"
        const targetBucket = SUPABASE_BUCKET

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabaseAdmin.storage
            .from(targetBucket)
            .upload(storagePath, fileBuffer, {
                contentType: contentType || 'application/octet-stream',
                upsert: true,
            })

        if (uploadError) {
            console.error("Supabase Storage upload error:", uploadError)
            return NextResponse.json({ error: `فشل الرفع لمساحة التخزين: ${uploadError.message}` }, { status: 500 })
        }

        // Avatars and Thumbnails: permanent non-expiring URL via platform storage routes
        // Completely free of tokens and expiration dates - works forever (20, 50, 100 years)
        // while keeping the main bucket strictly private against leaks.
        // Protected assets (videos, files, payment_proofs, questions) use short-lived signed URLs (15m)
        let finalUrl = ""
        if (isAvatar) {
            finalUrl = `/api/storage/avatar?path=${encodeURIComponent(storagePath)}`
        } else if (rawFolder === "thumbnails") {
            finalUrl = `/api/storage/thumbnail?path=${encodeURIComponent(storagePath)}`
        } else {
            // Protected asset in private bucket: generate short-lived signed URL (valid for 15 minutes = 900s)
            const { data: signedData, error: signError } = await supabaseAdmin.storage
                .from(targetBucket)
                .createSignedUrl(storagePath, 900)

            finalUrl = signedData?.signedUrl || `/api/storage/sign?url=${encodeURIComponent(storagePath)}`
        }

        return NextResponse.json({
            success: true,
            url: finalUrl,
            storagePath: storagePath,
            bucket: targetBucket,
            type: rawFolder === 'videos' ? 'video' : 'storage'
        })
    } catch (err: any) {
        console.error("Upload API handler error:", err)
        return NextResponse.json({ error: "خطأ داخلي أثناء معالجة الرفع" }, { status: 500 })
    }
}
