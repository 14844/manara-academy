import { NextRequest, NextResponse } from "next/server"
import { BUNNY_CONFIG } from "@/lib/bunny/config"
import crypto from "crypto"

export const runtime = 'nodejs'

function signUrl(path: string, securityKey: string, expirationSeconds: number = 3600 * 5) {
    const expires = Math.floor(Date.now() / 1000) + expirationSeconds;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const hash = crypto.createHash('md5')
        .update(securityKey + normalizedPath + expires)
        .digest('hex');
    
    return `${normalizedPath}?token=${hash}&expires=${expires}`;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) return new NextResponse("Missing URL", { status: 400 })

    try {
        // 1. Extract path from full URL
        const pullZoneHost = new URL(BUNNY_CONFIG.PULL_ZONE_URL || "https://manara-academy.b-cdn.net").host
        let path = ""
        
        // Handle double proxying (if URL is already /api/storage/sign?url=...)
        if (url.includes('/api/storage/sign?url=')) {
            const nestedUrl = new URL(url, request.url).searchParams.get('url')
            if (nestedUrl) return GET(new NextRequest(new URL(`/api/storage/sign?url=${encodeURIComponent(nestedUrl)}`, request.url)))
        }

        if (url.includes(pullZoneHost)) {
            path = new URL(url).pathname
        } else if (url.startsWith('https://storage.bunnycdn.com')) {
             // Already a storage URL, extract path
             const parts = url.split('/')
             path = '/' + parts.slice(4).join('/')
        } else if (!url.startsWith('http')) {
            path = url.startsWith('/') ? url : `/${url}`
        } else {
             // Not our pull zone or unknown, redirect just in case
             return NextResponse.redirect(url)
        }

        // 2. Clean path (remove tokens/query)
        const cleanPath = path.split('?')[0].replace(/^\//, '')
        
        // 3. Construct Direct Storage URL
        const storageUrl = `https://${BUNNY_CONFIG.STORAGE_ENDPOINT}/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${cleanPath}`
        
        console.log("Ultimate Proxy Fetching from Storage:", storageUrl)

        // 4. Fetch from Storage using ACCESS_KEY (Full Permissions)
        const accessKey = BUNNY_CONFIG.ACCESS_KEY;
        
        if (!accessKey) {
            console.error("[Proxy] ERROR: BUNNY_ACCESS_KEY is missing from environment variables!");
            return new NextResponse("Server Configuration Error: Missing Access Key", { status: 500 });
        }

        console.log(`[Proxy] Requesting: ${storageUrl}`);
        let response = await fetch(storageUrl, {
            method: 'GET',
            headers: {
                'AccessKey': accessKey,
                'accept': '*/*'
            }
        })

        // 4.1 Fallback to global endpoint if region-specific fails
        if (!response.ok && BUNNY_CONFIG.STORAGE_ENDPOINT !== "storage.bunnycdn.com") {
             const fallbackUrl = `https://storage.bunnycdn.com/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${cleanPath}`;
             console.log(`[Proxy] Retrying with global endpoint: ${fallbackUrl}`);
             response = await fetch(fallbackUrl, {
                 method: 'GET',
                 headers: {
                     'AccessKey': BUNNY_CONFIG.ACCESS_KEY || '',
                     'accept': '*/*'
                 }
             });
        }

        if (!response.ok) {
            const errText = await response.text().catch(() => "Unknown error");
            console.error(`[Proxy] Bunny Error (${response.status}):`, errText);
            console.log(`[Proxy] Attempted AccessKey: ${BUNNY_CONFIG.ACCESS_KEY?.substring(0, 5)}...`);
            console.log(`[Proxy] Attempted Zone: ${BUNNY_CONFIG.STORAGE_ZONE_NAME}`);
            
            return new NextResponse(`Error fetching asset: ${response.status} - ${errText}`, { status: response.status })
        }

        // 5. Stream response back with correct headers
        const blob = await response.blob()
        return new NextResponse(blob, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                'Access-Control-Allow-Origin': '*'
            }
        })

    } catch (e: any) {
        console.error("Ultimate Proxy Error:", e.message)
        return new NextResponse(`Proxy Error: ${e.message}`, { status: 500 })
    }
}
