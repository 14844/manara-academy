import { NextRequest, NextResponse } from "next/server"
import { BUNNY_CONFIG } from "@/lib/bunny/config"
import crypto from "crypto"
import { getServerAuth } from "@/lib/server-auth"
import { adminDb } from "@/lib/firebase/admin"

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    const user = await getServerAuth(request)
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
        return NextResponse.json({ error: "غير مصرح لك برفع الملفات" }, { status: 403 })
    }
    if (user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawFileName = searchParams.get('fileName') || 'Untitled'
    const rawFolder = searchParams.get('folder') || 'general'
    const contentType = request.headers.get('content-type') || 'application/octet-stream'

    // Clean folder and fileName: only alphanumeric, dot, dash, underscore
    const fileName = rawFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const folder = rawFolder.replace(/[^a-zA-Z0-9\-_]/g, '_')

    if (!fileName || fileName.includes('..') || folder.includes('..')) {
        return NextResponse.json({ error: "اسم الملف أو المجلد غير صالح" }, { status: 400 })
    }

    const isVideo = contentType.startsWith('video/')
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    const allowedDocTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

    if (isVideo) {
        if (!allowedVideoTypes.includes(contentType)) {
            return NextResponse.json({ error: "نوع الفيديو غير مدعوم" }, { status: 400 })
        }
    } else {
        if (!allowedDocTypes.includes(contentType)) {
            return NextResponse.json({ error: "نوع الملف غير مسموح به" }, { status: 400 })
        }
        const contentLength = Number(request.headers.get('content-length') || 0)
        if (contentLength > 50 * 1024 * 1024) {
            return NextResponse.json({ error: "حجم الملف يتجاوز الحد الأقصى (50MB)" }, { status: 400 })
        }
    }

    // Isolate folders per instructor, or per course if courseId is provided and authorized
    const courseId = searchParams.get('courseId')
    let safeFolder = user.role === 'admin' ? folder : `instructor_${user.uid}_${folder}`

    if (courseId && /^[\w-]+$/.test(courseId)) {
        const courseDoc = await adminDb.collection("courses").doc(courseId).get()
        if (courseDoc.exists && (courseDoc.data()?.instructor_id === user.uid || user.role === "admin")) {
            safeFolder = `courses/${courseId}/${folder}`
        }
    }

    try {
        if (isVideo) {
            const createUrl = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.VIDEO_LIBRARY_ID}/videos`
            const createRes = await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'AccessKey': BUNNY_CONFIG.STREAM_API_KEY || "",
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify({ 
                    title: fileName,
                    tags: [safeFolder, `instructor_${user.uid}`]
                })
            })

            if (!createRes.ok) {
                return NextResponse.json({ error: "فشل إنشاء سجل الفيديو" }, { status: createRes.status })
            }
            
            const { guid } = await createRes.json()

            const expiration = Math.floor(Date.now() / 1000) + 3600 // 1 hour
            const libId = (BUNNY_CONFIG.VIDEO_LIBRARY_ID || "").trim()
            const apiKey = (BUNNY_CONFIG.STREAM_API_KEY || "").trim()
            const signatureInput = `${libId}${apiKey}${expiration}${guid}`
            
            const signature = crypto.createHash('sha256').update(signatureInput).digest('hex')

            return NextResponse.json({ 
                success: true, 
                guid,
                libraryId: libId,
                signature,
                expiration,
                type: 'stream'
            })
        } else {
            const filePath = `${safeFolder}/${fileName}`
            const bunnyUrl = `https://${BUNNY_CONFIG.STORAGE_ENDPOINT}/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${filePath}`
            
            const response = await fetch(bunnyUrl, {
                method: 'PUT',
                headers: {
                    'AccessKey': BUNNY_CONFIG.ACCESS_KEY || "",
                    'Content-Type': contentType || 'application/octet-stream',
                },
                body: request.body,
                // @ts-ignore
                duplex: 'half'
            })

            if (!response.ok) {
                return NextResponse.json({ success: false, error: "فشل الرفع لمساحة التخزين" }, { status: response.status })
            }

            const proxyUrl = `/api/storage/sign?url=${encodeURIComponent(filePath)}`

            return NextResponse.json({ 
                success: true, 
                url: proxyUrl,
                type: 'storage'
            })
        }
    } catch {
        return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 })
    }
}
