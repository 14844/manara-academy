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
            } else {
                return new NextResponse("Forbidden", { status: 403 })
            }
        }

        const accessKey = BUNNY_CONFIG.ACCESS_KEY
        if (!accessKey) {
            return new NextResponse("Server Configuration Error", { status: 500 })
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
        // Block SVG XSS: never serve SVG as image/svg+xml
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
