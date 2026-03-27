import { NextRequest, NextResponse } from "next/server"
import { BUNNY_CONFIG } from "@/lib/bunny/config"

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName') || 'Untitled'
    const folder = searchParams.get('folder') || 'general'
    const contentType = request.headers.get('content-type') || 'application/octet-stream'
    
    // Determine if it's a video for Stream or other file for Storage
    const isVideo = contentType.startsWith('video/')
    
    try {
        if (isVideo) {
            // ── VIDEO STREAM UPLOAD ───────────────────────────────────────────
            // 1. Create video entry
            const createUrl = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.VIDEO_LIBRARY_ID}/videos`
            const createRes = await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'AccessKey': BUNNY_CONFIG.STREAM_API_KEY,
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify({ title: fileName })
            })

            if (!createRes.ok) {
                const errText = await createRes.text();
                console.error("Bunny Stream Create Error:", errText);
                return NextResponse.json({ error: `فشل إنشاء سجل الفيديو: ${errText}` }, { status: createRes.status });
            }
            
            const { guid } = await createRes.json()

            // 2. Upload content
            const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_CONFIG.VIDEO_LIBRARY_ID}/videos/${guid}`
            
            // NOTE: We do NOT manually set Content-Length as it can cause issues in Node.js fetch with streams
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 
                    'AccessKey': BUNNY_CONFIG.STREAM_API_KEY,
                    'Content-Type': contentType,
                },
                body: request.body,
                // @ts-ignore
                duplex: 'half'
            })

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                console.error("Bunny Stream Upload Error:", errText);
                return NextResponse.json({ error: `فشل رفع محتوى الفيديو: ${errText}` }, { status: uploadRes.status });
            }

            return NextResponse.json({ 
                success: true, 
                url: `bunny_stream://${guid}`,
                type: 'stream'
            })
        } else {
            // ── STANDARD STORAGE UPLOAD (Images/Docs) ─────────────────────────
            const filePath = `${folder}/${fileName}`
            const bunnyUrl = `https://${BUNNY_CONFIG.STORAGE_ENDPOINT}/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${filePath}`
            
            const response = await fetch(bunnyUrl, {
                method: 'PUT',
                headers: {
                    'AccessKey': BUNNY_CONFIG.ACCESS_KEY,
                    'Content-Type': contentType,
                },
                body: request.body,
                // @ts-ignore
                duplex: 'half'
            })

            if (!response.ok) {
                const errText = await response.text();
                return NextResponse.json({ error: `خطأ التخزين: ${errText}` }, { status: response.status });
            }

            const publicUrl = `${BUNNY_CONFIG.PULL_ZONE_URL}/${filePath}`
            return NextResponse.json({ 
                success: true, 
                url: publicUrl,
                type: 'storage'
            })
        }
    } catch (error: any) {
        console.error("Upload API Critical Error:", error)
        return NextResponse.json({ error: `خطأ داخلي في الخادم: ${error.message}` }, { status: 500 })
    }
}
