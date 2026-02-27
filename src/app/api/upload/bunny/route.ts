import { NextRequest, NextResponse } from "next/server"
import { BUNNY_CONFIG } from "@/lib/bunny/config"

export const runtime = 'edge' // Use edge runtime for better streaming performance if supported

export async function PUT(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')
    const folder = searchParams.get('folder') || 'general'

    if (!fileName) {
        return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })
    }

    const filePath = `${folder}/${fileName}`
    const bunnyUrl = `https://${BUNNY_CONFIG.STORAGE_ENDPOINT}/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${filePath}`

    try {
        // Forward the request body (ReadableStream) directly to Bunny.net
        const response = await fetch(bunnyUrl, {
            method: 'PUT',
            headers: {
                'AccessKey': BUNNY_CONFIG.ACCESS_KEY,
                'Content-Type': request.headers.get('content-type') || 'application/octet-stream',
            },
            body: request.body,
            // @ts-ignore - duplex is required for streaming request bodies in fetch
            duplex: 'half'
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("Bunny API Error:", errorText)
            return NextResponse.json({ error: `Bunny storage error: ${errorText}` }, { status: response.status })
        }

        const publicUrl = `${BUNNY_CONFIG.PULL_ZONE_URL}/${filePath}`
        return NextResponse.json({ success: true, url: publicUrl })
    } catch (error: any) {
        console.error("Upload API Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
