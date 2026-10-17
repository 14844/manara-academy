import { NextRequest, NextResponse } from "next/server"
import { BUNNY_CONFIG } from "@/lib/bunny/config"
import { getServerAuth } from "@/lib/server-auth"
import { adminDb } from "@/lib/firebase/admin"

export const runtime = 'nodejs'

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

        // Strict path-based authorization: path must start with courses/<id>/ or instructor_<uid>_
        if (user.role !== "admin") {
            if (cleanPath.startsWith('courses/')) {
                const parts = cleanPath.split('/')
                const courseId = parts[1]

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
                    if (!enrollmentDoc.exists) {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                    const enrData = enrollmentDoc.data()
                    if (enrData?.status !== "active") {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                }
            } else if (cleanPath.startsWith(`instructor_${user.uid}_`)) {
                // Instructor accessing their own uploaded folder
            } else if (cleanPath.startsWith('instructor_')) {
                // Enrolled student accessing instructor-uploaded file
                const parts = cleanPath.split('_')
                const instructorUid = parts[1]
                if (!instructorUid) {
                    return new NextResponse("Forbidden", { status: 403 })
                }

                const reqCourseId = searchParams.get('courseId')
                if (reqCourseId && /^[\w-]+$/.test(reqCourseId)) {
                    const enrSnap = await adminDb.collection("enrollments").doc(`${user.uid}_${reqCourseId}`).get()
                    if (!enrSnap.exists || enrSnap.data()?.status !== "active") {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                    const cSnap = await adminDb.collection("courses").doc(reqCourseId).get()
                    if (!cSnap.exists || cSnap.data()?.instructor_id !== instructorUid) {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                } else {
                    const enrollmentsSnap = await adminDb.collection("enrollments")
                        .where("student_id", "==", user.uid)
                        .where("status", "==", "active")
                        .get()
                    
                    if (enrollmentsSnap.empty) {
                        return new NextResponse("Forbidden", { status: 403 })
                    }

                    const enrolledCourseIds = enrollmentsSnap.docs.map(d => d.data().course_id).filter(Boolean)
                    let isEnrolledWithInstructor = false
                    for (const cId of enrolledCourseIds) {
                        const cDoc = await adminDb.collection("courses").doc(cId).get()
                        if (cDoc.exists && cDoc.data()?.instructor_id === instructorUid) {
                            isEnrolledWithInstructor = true
                            break
                        }
                    }

                    if (!isEnrolledWithInstructor) {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                }
            } else if (cleanPath.startsWith('avatars/') || cleanPath.startsWith('thumbnails/') || cleanPath.startsWith('questions/')) {
                // Public/educational assets accessible to authenticated users
            } else if (cleanPath.startsWith('payment_proofs/')) {
                // Payment proof receipts: only the student who uploaded or admin can access
                const isStudentOwner = cleanPath.includes(`_${user.uid}_`)
                if (!isStudentOwner) {
                    return new NextResponse("Forbidden", { status: 403 })
                }
            } else if (cleanPath.startsWith('files/courses/') || cleanPath.startsWith('videos/courses/')) {
                const parts = cleanPath.split('/')
                const courseId = parts[2]
                if (!courseId) return new NextResponse("Forbidden", { status: 403 })

                const courseDoc = await adminDb.collection("courses").doc(courseId).get()
                if (!courseDoc.exists) return new NextResponse("Course not found", { status: 404 })

                const isCourseInstructor = courseDoc.data()?.instructor_id === user.uid
                if (!isCourseInstructor) {
                    const enrollmentDoc = await adminDb.collection("enrollments").doc(`${user.uid}_${courseId}`).get()
                    if (!enrollmentDoc.exists || enrollmentDoc.data()?.status !== "active") {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                }
            } else if (cleanPath.startsWith('files/instructor_') || cleanPath.startsWith('videos/instructor_')) {
                const parts = cleanPath.split('/')
                const subParts = parts[1]?.split('_') || []
                const instructorUid = subParts[1]
                if (!instructorUid) return new NextResponse("Forbidden", { status: 403 })

                if (instructorUid !== user.uid) {
                    // Check if student is enrolled in any of this instructor's courses
                    const enrollmentsSnap = await adminDb.collection("enrollments")
                        .where("student_id", "==", user.uid)
                        .where("instructor_id", "==", instructorUid)
                        .where("status", "==", "active")
                        .limit(1)
                        .get()
                    if (enrollmentsSnap.empty) {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                }
            } else {
                return new NextResponse("Forbidden", { status: 403 })
            }
        }

        // 1. Try Supabase Storage first
        try {
            const { supabaseAdmin, SUPABASE_BUCKET } = await import("@/lib/supabase/config")
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from(SUPABASE_BUCKET)
                .download(cleanPath)

            if (fileData && !downloadError) {
                let contentType = fileData.type || 'application/octet-stream'
                if (contentType.includes("image/svg+xml")) {
                    contentType = 'application/octet-stream'
                }

                const isPdf = cleanPath.toLowerCase().endsWith(".pdf") || contentType.includes("pdf")
                const headers: Record<string, string> = {
                    'Content-Type': contentType,
                    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                    'X-Content-Type-Options': 'nosniff',
                    'Content-Security-Policy': 'sandbox',
                }

                if (isPdf) {
                    headers['Content-Disposition'] = 'inline'
                }

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

        let contentType = response.headers.get('Content-Type') || 'application/octet-stream'
        if (contentType.includes("image/svg+xml")) {
            contentType = 'application/octet-stream'
        }

        const isPdf = cleanPath.toLowerCase().endsWith(".pdf") || contentType.includes("pdf")

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': 'sandbox',
        }

        if (isPdf) {
            headers['Content-Disposition'] = 'inline'
        }

        const blob = await response.blob()
        return new NextResponse(blob, { headers })

    } catch {
        return new NextResponse("Error fetching asset", { status: 500 })
    }
}
