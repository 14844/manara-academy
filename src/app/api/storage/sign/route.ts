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
    const url = searchParams.get('url')
    
    if (!url) return new NextResponse("Missing URL", { status: 400 })
    if (url.includes('..')) return new NextResponse("Invalid Path", { status: 400 })

    try {
        const pullZoneHost = new URL(BUNNY_CONFIG.PULL_ZONE_URL || "https://manara-academy.b-cdn.net").host
        let path = ""

        if (url.includes(pullZoneHost)) {
            path = new URL(url).pathname
        } else if (url.startsWith('https://storage.bunnycdn.com')) {
            const parts = url.split('/')
            path = '/' + parts.slice(4).join('/')
        } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            path = url
        } else {
            return new NextResponse("Invalid or unsupported URL", { status: 400 })
        }

        const cleanPath = path.split('?')[0].replace(/^\/+/, '')
        if (cleanPath.includes('..')) {
            return new NextResponse("Invalid Path", { status: 400 })
        }

        // Check course authorization if courseId is passed or in path
        const courseId = searchParams.get('courseId') || (cleanPath.startsWith('courses/') ? cleanPath.split('/')[1] : null)
        if (user.role !== "admin") {
            if (courseId) {
                const courseDoc = await adminDb.collection("courses").doc(courseId).get()
                const isCourseInstructor = courseDoc.exists && courseDoc.data()?.instructor_id === user.uid
                if (!isCourseInstructor) {
                    const enrollmentDoc = await adminDb.collection("enrollments").doc(`${user.uid}_${courseId}`).get()
                    if (!enrollmentDoc.exists) {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                    const enrData = enrollmentDoc.data()
                    if (enrData?.status === "blocked" || enrData?.status === "suspended") {
                        return new NextResponse("Forbidden", { status: 403 })
                    }
                }
            } else if (user.role === "student" && cleanPath.startsWith('courses/')) {
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

        const blob = await response.blob()
        return new NextResponse(blob, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            }
        })

    } catch {
        return new NextResponse("Error fetching asset", { status: 500 })
    }
}
