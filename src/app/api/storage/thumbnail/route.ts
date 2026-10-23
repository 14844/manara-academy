import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase/admin"
import { detectImageMime, safeImageHeaders } from "@/lib/media-security"

export const runtime = 'nodejs'

/**
 * Permanent, Non-Expiring Course Thumbnail Endpoint
 * GET /api/storage/thumbnail?path=thumbnails/thumb_123.png
 * 
 * - Delivers course thumbnails permanently with NO token expiration.
 * - Works securely while the main Supabase bucket remains private.
 * - Heavily cached in browser and CDN for high performance.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const rawPath = searchParams.get('path') || searchParams.get('url') || ""

    if (!rawPath) {
        return new NextResponse("Missing thumbnail path", { status: 400 })
    }

    // Decode and normalize
    let decodedPath = rawPath
    while (decodedPath.includes("%")) {
        try {
            const next = decodeURIComponent(decodedPath)
            if (next === decodedPath) break
            decodedPath = next
        } catch {
            break
        }
    }

    // If a full Supabase URL was passed, extract just the thumbnails/... pathname
    let cleanPath = decodedPath
    if (cleanPath.includes("/thumbnails/")) {
        cleanPath = "thumbnails/" + cleanPath.split("/thumbnails/")[1]
    }
    cleanPath = cleanPath.split("?")[0].replace(/^\/+/, "")

    // Security check: Must strictly target thumbnails/ folder and avoid path traversal
    if (!cleanPath.startsWith("thumbnails/") || cleanPath.includes("..") || cleanPath.includes("\0")) {
        return new NextResponse("Invalid thumbnail path", { status: 400 })
    }

    try {
        const { data: blob, error } = await supabaseAdmin.storage
            .from(SUPABASE_BUCKET)
            .download(cleanPath)

        if (error || !blob) {
            return new NextResponse("Thumbnail not found", { status: 404 })
        }

        const buffer = await blob.arrayBuffer()
        const uint8 = new Uint8Array(buffer)

        // Verify magic bytes: strictly allow image/png, image/jpeg, image/webp
        const detectedMime = detectImageMime(uint8)
        if (!detectedMime) {
            return new NextResponse("Invalid image format", { status: 415 })
        }

        return new NextResponse(buffer, {
            status: 200,
            headers: safeImageHeaders(detectedMime, cleanPath.split("/").pop() || "thumbnail", "public, max-age=31536000, immutable")
        })
    } catch (err: any) {
        console.error("Thumbnail proxy error:", err)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}

