import { adminStorage } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    // Security Check: Ensure user is logged in via session cookie
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const bucket = adminStorage.bucket();
        const file = bucket.file(path);

        // Generate a signed URL that expires in 1 hour
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        return NextResponse.json({ url });
    } catch (error) {
        console.error('Sign URL Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
