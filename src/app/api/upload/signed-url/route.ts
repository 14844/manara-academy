import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase/admin"
import { getActiveServerAuth } from "@/lib/server-auth"
import { checkCourseOwnership, normalizeImageMime, withImageExtension } from "@/lib/media-security"

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

/**
 * Generate a signed upload URL for direct client-to-Supabase upload.
 * This bypasses Vercel's 4.5MB body size limit entirely.
 * 
 * Flow: Client requests signed URL → Client uploads directly to Supabase Storage → No Vercel limit
 */
export async function POST(request: NextRequest) {
    const user = await getActiveServerAuth(request)
    if (!user) {
        return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 })
    }
    if (user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "الحساب موقوف، لا يمكنك رفع ملفات" }, { status: 403 })
    }

    const body = await request.json()
    const { fileName, folder, courseId, contentType, fileSize } = body

    if (!fileName || !folder || !contentType) {
        return NextResponse.json({ error: "بيانات ناقصة (fileName, folder, contentType)" }, { status: 400 })
    }

    // Validate folder
    const rawFolder = (folder || 'files').toLowerCase()
    const validFolders = ["avatars", "payment_proofs", "thumbnails", "questions", "files", "videos"]
    if (!validFolders.includes(rawFolder)) {
        return NextResponse.json({ error: "مجلد الرفع غير صالح" }, { status: 400 })
    }

    // Role-based permissions
    if (user.role === "student") {
        if (rawFolder !== "avatars" && rawFolder !== "payment_proofs") {
            return NextResponse.json({ 
                error: "غير مصرح للطلاب برفع الملفات في هذا القسم" 
            }, { status: 403 })
        }
    } else if (user.role === "instructor") {
        if (rawFolder === "payment_proofs") {
            return NextResponse.json({ error: "إيصالات الشحن مخصصة للطلاب فقط" }, { status: 403 })
        }
    }

    // Validate MIME type
    const allowedMimes = ALLOWED_TYPES[rawFolder] || []
    const baseContentType = String(contentType || "").split(";")[0].trim().toLowerCase()
    const isAllowedMime = allowedMimes.includes(baseContentType)
    if (!isAllowedMime) {
        return NextResponse.json({ 
            error: `نوع الملف (${contentType}) غير مدعوم في مجلد ${rawFolder}` 
        }, { status: 400 })
    }

    // Validate file size
    const maxLimit = SIZE_LIMITS[rawFolder] || (10 * 1024 * 1024)
    if (fileSize && Number(fileSize) > maxLimit) {
        const mb = Math.round(maxLimit / (1024 * 1024))
        return NextResponse.json({ 
            error: `حجم الملف يتجاوز الحد الأقصى (${mb} ميجابايت)` 
        }, { status: 400 })
    }

    // Sanitize file name
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    if (!cleanFileName || cleanFileName.includes('..')) {
        return NextResponse.json({ error: "اسم الملف غير صالح" }, { status: 400 })
    }

    // Course-bound folders: courseId is required for videos/files and must belong to the uploader
    const needsCourse = rawFolder === "videos" || rawFolder === "files"
    if (needsCourse || courseId) {
        const ownErr = await checkCourseOwnership(courseId, user)
        if (ownErr) {
            return NextResponse.json({ error: ownErr }, { status: 403 })
        }
    }

    // Image folders: whitelisted image types only, extension forced to match
    const isImageFolder = ["avatars", "payment_proofs", "thumbnails", "questions"].includes(rawFolder)
    const declaredImageMime = isImageFolder ? normalizeImageMime(contentType) : null
    if (isImageFolder && !declaredImageMime) {
        return NextResponse.json({ error: "يسمح فقط بصور PNG أو JPEG أو WEBP" }, { status: 400 })
    }
    const finalFileName = declaredImageMime ? withImageExtension(cleanFileName, declaredImageMime) : cleanFileName

    // Build storage path
    const timestamp = Date.now()
    let storagePath = ""

    if (rawFolder === "avatars") {
        storagePath = `avatars/avatar_${user.uid}_${timestamp}_${finalFileName}`
    } else if (rawFolder === "payment_proofs") {
        storagePath = `payment_proofs/proof_${user.uid}_${timestamp}_${finalFileName}`
    } else if (rawFolder === "thumbnails") {
        storagePath = courseId 
            ? `thumbnails/course_${courseId}_${timestamp}_${finalFileName}`
            : `thumbnails/thumb_${user.uid}_${timestamp}_${finalFileName}`
    } else if (rawFolder === "questions") {
        storagePath = `questions/q_${user.uid}_${timestamp}_${finalFileName}`
    } else if (rawFolder === "videos") {
        storagePath = courseId
            ? `videos/courses/${courseId}/${timestamp}_${finalFileName}`
            : `videos/instructor_${user.uid}/${timestamp}_${finalFileName}`
    } else {
        storagePath = courseId
            ? `files/courses/${courseId}/${timestamp}_${finalFileName}`
            : `files/instructor_${user.uid}/${timestamp}_${finalFileName}`
    }

    try {
        // Create a signed upload URL (valid for 10 minutes)
        const { data, error } = await supabaseAdmin.storage
            .from(SUPABASE_BUCKET)
            .createSignedUploadUrl(storagePath)

        if (error || !data) {
            console.error("Signed upload URL error:", error)
            return NextResponse.json({ error: `فشل إنشاء رابط الرفع: ${error?.message}` }, { status: 500 })
        }

        // Build the final URL that will be used after upload completes
        let finalUrl = ""
        if (rawFolder === "avatars") {
            finalUrl = `/api/storage/avatar?path=${encodeURIComponent(storagePath)}`
        } else if (rawFolder === "thumbnails") {
            finalUrl = `/api/storage/thumbnail?path=${encodeURIComponent(storagePath)}`
        } else {
            // For videos, files, and questions: store clean storagePath (e.g. videos/courses/...)
            // This is recognized by /api/video/token and all platform streaming routes
            finalUrl = storagePath
        }

        return NextResponse.json({
            success: true,
            signedUrl: data.signedUrl,
            token: data.token,
            storagePath,
            finalUrl,
            bucket: SUPABASE_BUCKET,
            folder: rawFolder,
        })
    } catch (err: any) {
        console.error("Signed URL generation error:", err)
        return NextResponse.json({ error: "خطأ داخلي أثناء إنشاء رابط الرفع" }, { status: 500 })
    }
}
