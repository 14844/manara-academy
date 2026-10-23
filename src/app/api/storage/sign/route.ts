import { NextRequest, NextResponse } from "next/server"
import { BUNNY_CONFIG } from "@/lib/bunny/config"
import { getServerAuth } from "@/lib/server-auth"
import { adminDb } from "@/lib/firebase/admin"

export const runtime = 'nodejs'

const INLINE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "video/quicktime"]

function buildAssetHeaders(rawType: string, cleanPath: string): Record<string, string> {
    const base = String(rawType || "").split(";")[0].trim().toLowerCase()
    const isInline = INLINE_TYPES.includes(base)
    const fileName = (cleanPath.split("/").pop() || "file").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100)
    return {
        'Content-Type': isInline ? base : 'application/octet-stream',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${fileName}"`,
    }
}

export async function GET(request: NextRequest) {
    const user = await getServerAuth(request)
    if (!user || user.status === "blocked" || user.status === "suspended") {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawUrl = searchParams.get('url')
    
    if (!rawUrl) return new NextResponse("Missing URL", { status: 400 })

    // Decode and normalize path (handle %2e%2e, double encoding, and traversal)
    let decodedUrl = rawUrl
    while (decodedUrl.includes("%")) {
        try {
            const next = decodeURIComponent(decodedUrl)
            if (next === decodedUrl) break
            decodedUrl = next
        } catch {
            break
        }
    }

    if (decodedUrl.includes("..") || decodedUrl.includes("\0")) {
        return new NextResponse("Invalid Path", { status: 400 })
    }

    try {
        const pullZoneHost = new URL(BUNNY_CONFIG.PULL_ZONE_URL || "https://manara-academy.b-cdn.net").host
        let path = ""

        if (decodedUrl.includes(pullZoneHost)) {
            path = new URL(decodedUrl).pathname
        } else if (decodedUrl.startsWith('https://storage.bunnycdn.com')) {
            const parts = decodedUrl.split('/')
            path = '/' + parts.slice(4).join('/')
        } else if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
            path = decodedUrl
        } else {
            return new NextResponse("Invalid or unsupported URL", { status: 400 })
        }

        const cleanPath = path.split('?')[0].replace(/^\/+/, '')
        if (cleanPath.includes('..') || cleanPath.includes('\0')) {
            return new NextResponse("Invalid Path", { status: 400 })
        }

        // Strict course-specific authorization
        if (user.role !== "admin") {
            const reqCourseId = searchParams.get('courseId')

            if (cleanPath.startsWith('courses/') || cleanPath.startsWith('files/courses/') || cleanPath.startsWith('videos/courses/')) {
                let courseId = ""
                if (cleanPath.startsWith('courses/')) {
                    courseId = cleanPath.split('/')[1]
                } else if (cleanPath.startsWith('files/courses/')) {
                    courseId = cleanPath.split('/')[2]
                } else if (cleanPath.startsWith('videos/courses/')) {
                    courseId = cleanPath.split('/')[2]
                }

                if (!courseId || !/^[\w-]+$/.test(courseId)) {
                    return new NextResponse("Invalid Course ID", { status: 400 })
                }

                const courseDoc = await adminDb.collection("courses").doc(courseId).get()
                if (!courseDoc.exists) {
                    return new NextResponse("Course not found", { status: 404 })
                }

                const isCourseInstructor = courseDoc.data()?.instructor_id === user.uid
                if (!isCourseInstructor) {
                    const enrollmentDoc = await adminDb.collection("enrollments").doc(`${user.uid}_${courseId}`).get()
                    if (!enrollmentDoc.exists || enrollmentDoc.data()?.status !== "active") {
                        return new NextResponse("Forbidden: ليس لديك اشتراك نشط في هذا الكورس", { status: 403 })
                    }
                }
            } else if (cleanPath.startsWith(`instructor_${user.uid}_`) || cleanPath.startsWith(`files/instructor_${user.uid}/`) || cleanPath.startsWith(`videos/instructor_${user.uid}/`)) {
                // Instructor accessing their own uploaded assets
            } else if (cleanPath.startsWith('instructor_') || cleanPath.startsWith('files/instructor_') || cleanPath.startsWith('videos/instructor_')) {
                // Must specify courseId and be actively enrolled in THAT specific course
                let instructorUid = ""
                if (cleanPath.startsWith('instructor_')) {
                    instructorUid = cleanPath.split('_')[1]
                } else {
                    const parts = cleanPath.split('/')
                    instructorUid = parts[1]?.split('_')[1] || ""
                }

                if (!instructorUid) {
                    return new NextResponse("Forbidden", { status: 403 })
                }

                if (!reqCourseId || !/^[\w-]+$/.test(reqCourseId)) {
                    return new NextResponse("Forbidden: يجب تحديد معرّف الكورس للوصول إلى هذا الملف", { status: 403 })
                }

                // Verify the course belongs to this instructor
                const cSnap = await adminDb.collection("courses").doc(reqCourseId).get()
                if (!cSnap.exists || cSnap.data()?.instructor_id !== instructorUid) {
                    return new NextResponse("Forbidden: الملف لا ينتمي إلى الكورس المحدد", { status: 403 })
                }

                // Verify the student has an active enrollment in THIS specific course
                const enrSnap = await adminDb.collection("enrollments").doc(`${user.uid}_${reqCourseId}`).get()
                if (!enrSnap.exists || enrSnap.data()?.status !== "active") {
                    return new NextResponse("Forbidden: ليس لديك اشتراك نشط في هذا الكورس", { status: 403 })
                }

                // Bind the asset to THIS course: it must be referenced by one of the course's lessons
                const mediaSnap = await adminDb.doc(`courses/${reqCourseId}/private/media`).get()
                const mediaValues: string[] = []
                for (const v of Object.values(mediaSnap.data() || {})) {
                    if (typeof v === "string") mediaValues.push(v)
                    else if (v && typeof v === "object") {
                        const m = v as { video_path?: unknown; url?: unknown }
                        if (typeof m.video_path === "string") mediaValues.push(m.video_path)
                        if (typeof m.url === "string") mediaValues.push(m.url)
                    }
                }
                const isReferenced = mediaValues.some(val => {
                    let decoded = val
                    try { decoded = decodeURIComponent(val) } catch {}
                    return decoded.split("?")[0].replace(/^supabase:\/\//, "").replace(/^\/+/, "") === cleanPath ||
                        decoded.includes(`url=${cleanPath}`) || decoded.endsWith(`/${cleanPath}`)
                })
                if (!isReferenced) {
                    return new NextResponse("Forbidden: الملف لا ينتمي إلى الكورس المحدد", { status: 403 })
                }
            } else if (cleanPath.startsWith('avatars/') || cleanPath.startsWith('thumbnails/') || cleanPath.startsWith('questions/')) {
                // Public/educational assets accessible to authenticated users
            } else if (cleanPath.startsWith('payment_proofs/')) {
                // Payment proof receipts: only the student who uploaded or admin can access
                const isStudentOwner = cleanPath.includes(`_${user.uid}_`)
                if (!isStudentOwner) {
                    return new NextResponse("Forbidden", { status: 403 })
                }
            } else {
                return new NextResponse("Forbidden", { status: 403 })
            }
        }

        // 1. Try Supabase Storage first
        try {
            const { supabaseAdmin, SUPABASE_BUCKET, SUPABASE_PUBLIC_BUCKET } = await import("@/lib/supabase/admin")
            const bucketToUse = cleanPath.startsWith('avatars/') ? SUPABASE_PUBLIC_BUCKET : SUPABASE_BUCKET
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from(bucketToUse)
                .download(cleanPath)

            if (fileData && !downloadError) {
                const headers = buildAssetHeaders(fileData.type || '', cleanPath)
                return new NextResponse(fileData, { headers })
            }
        } catch (supabaseErr) {
            console.warn("Supabase download skipped, falling back to legacy storage:", supabaseErr)
        }

        // 2. Fallback to legacy Bunny Storage for older files
        const accessKey = BUNNY_CONFIG.ACCESS_KEY
        if (!accessKey) {
            return new NextResponse("Asset not found", { status: 404 })
        }

        const storageUrl = `https://${BUNNY_CONFIG.STORAGE_ENDPOINT}/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${cleanPath}`
        let response = await fetch(storageUrl, {
            method: 'GET',
            headers: {
                'AccessKey': accessKey,
                'accept': '*/*'
            }
        })

        if (!response.ok && BUNNY_CONFIG.STORAGE_ENDPOINT !== "storage.bunnycdn.com") {
            const fallbackUrl = `https://storage.bunnycdn.com/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${cleanPath}`
            response = await fetch(fallbackUrl, {
                method: 'GET',
                headers: {
                    'AccessKey': accessKey,
                    'accept': '*/*'
                }
            })
        }

        if (!response.ok) {
            return new NextResponse("Asset not found", { status: response.status })
        }

        const headers = buildAssetHeaders(response.headers.get('Content-Type') || '', cleanPath)

        const blob = await response.blob()
        return new NextResponse(blob, { headers })

    } catch {
        return new NextResponse("Error fetching asset", { status: 500 })
    }
}
