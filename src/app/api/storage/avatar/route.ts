import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase/admin"
import { detectImageMime, safeImageHeaders } from "@/lib/media-security"

export const runtime = 'nodejs'

/**
 * Permanent, Non-Expiring Avatar Endpoint
 * GET /api/storage/avatar?path=avatars/avatar_123.webp
 * 
 * - Works forever with NO expiration timestamp.
 * - Works seamlessly while the Supabase bucket remains strictly private.
 * - Strictly restricted to the avatars/ folder (blocks videos, payment_proofs, files).
 * - Caches heavily in the browser (1 year immutable) for instant loading.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const rawPath = searchParams.get('path') || searchParams.get('url') || ""

    if (!rawPath) {
        return new NextResponse("Missing avatar path", { status: 400 })
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

    // If a full URL was passed, extract just the avatars/... pathname
    let cleanPath = decodedPath
    if (cleanPath.includes("/avatars/")) {
        cleanPath = "avatars/" + cleanPath.split("/avatars/")[1]
    }
    cleanPath = cleanPath.split("?")[0].replace(/^\/+/, "")

    // Security check: Must strictly target avatars/ folder and avoid path traversal
    if (!cleanPath.startsWith("avatars/") || cleanPath.includes("..") || cleanPath.includes("\0")) {
        return new NextResponse("Invalid avatar path", { status: 400 })
    }

    try {
        const { data: blob, error } = await supabaseAdmin.storage
            .from(SUPABASE_BUCKET)
            .download(cleanPath)

        if (error || !blob) {
            return new NextResponse("Avatar not found", { status: 404 })
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
            headers: safeImageHeaders(detectedMime, cleanPath.split("/").pop() || "avatar", "public, max-age=31536000, immutable")
        })
    } catch (err: any) {
        console.error("Avatar serving error:", err)
        return new NextResponse("Error fetching avatar", { status: 500 })
    }
}

