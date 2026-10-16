import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";

export async function GET(request: Request) {
    const user = await getServerAuth(request);
    if (!user || user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const courseId = searchParams.get('courseId');

    if (!path) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    if (user.role !== "admin") {
        if (!courseId) {
            return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
        }
        const enrollment = await adminDb.collection("enrollments").doc(`${user.uid}_${courseId}`).get();
        if (!enrollment.exists || enrollment.data()?.status !== "active") {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
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
