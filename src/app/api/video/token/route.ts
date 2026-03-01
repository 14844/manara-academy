import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// استخراج YouTube Video ID من أي صيغة رابط
function extractYouTubeId(url: string): string | null {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11}).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
}

// تشفير بسيط: نقلب الـ videoId لمنع القراءة المباشرة في الـ URL
// الفيديو لن يظهر في الـ DOM - سيظهر فقط معرف مشفر مؤقت
function obfuscate(id: string): string {
    return Buffer.from(id).toString("base64");
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const lessonId = searchParams.get("lessonId");

    if (!courseId || !lessonId) {
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    // 1. التحقق من الجلسة
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let uid: string;
    let isAdmin = false;

    try {
        const decoded = await adminAuth.verifySessionCookie(session, true);
        uid = decoded.uid;

        // Check if user is admin
        const profileSnap = await adminDb.doc(`profiles/${uid}`).get();
        if (profileSnap.exists && profileSnap.data()?.role === "admin") {
            isAdmin = true;
        }
    } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2. التحقق من أن الطالب مسجّل في الكورس (تخطي للمسؤول)
    if (!isAdmin) {
        try {
            const enrollmentRef = adminDb.doc(`enrollments/${uid}_${courseId}`);
            const enrollmentSnap = await enrollmentRef.get();

            if (!enrollmentSnap.exists) {
                return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
            }
        } catch {
            return NextResponse.json({ error: "Enrollment check failed" }, { status: 500 });
        }
    }

    // 3. جلب الكورس والمحتوى من Firestore على السيرفر (لا يُرسل للـ client)
    try {
        const courseRef = adminDb.doc(`courses/${courseId}`);
        const courseSnap = await courseRef.get();

        if (!courseSnap.exists) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        const courseData = courseSnap.data();
        const modules = courseData?.modules || [];

        // البحث عن الدرس المطلوب
        let videoPath: string | null = null;
        for (const module of modules) {
            for (const lesson of module.lessons || []) {
                if (lesson.id?.toString() === lessonId?.toString()) {
                    videoPath = lesson.video_path || null;
                    break;
                }
            }
            if (videoPath !== null) break;
        }

        if (!videoPath) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        // 4. استخراج الـ videoId واستبداله بـ token مشفر
        const youtubeId = extractYouTubeId(videoPath);

        if (youtubeId) {
            // فيديو يوتيوب: إعادة الـ videoId مشفراً
            const token = obfuscate(youtubeId);
            return NextResponse.json({
                type: "youtube",
                token, // مشفر بـ base64url - يُفكّ في العميل فقط أثناء التشغيل
                origin: new URL(request.url).origin,
            });
        } else if (videoPath.includes("drive.google.com")) {
            // جوجل درايف
            return NextResponse.json({ type: "drive", url: videoPath });
        } else if (videoPath.startsWith("http")) {
            // رابط مباشر - نولّد signed URL من Firebase Storage إذا أردنا
            return NextResponse.json({ type: "direct", url: videoPath });
        } else {
            return NextResponse.json({ error: "Unknown video type" }, { status: 422 });
        }
    } catch (err) {
        console.error("Video token error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
