import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { signBunnyUrl } from "@/lib/bunny/utils";
import { BUNNY_CONFIG } from "@/lib/bunny/config";
import { getServerAuth } from "@/lib/server-auth";
import crypto from "crypto";

// استخراج YouTube Video ID من أي صيغة رابط (بما في ذلك Shorts)
function extractYouTubeId(url: string): string | null {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]{11}).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
}

function obfuscate(id: string): string {
    return Buffer.from(id).toString("base64");
}

export async function GET(request: Request) {
    const user = await getServerAuth(request);
    if (!user || user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const lessonId = searchParams.get("lessonId");

    if (!courseId || !lessonId) {
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const safeId = /^[\w-]+$/;
    if (!safeId.test(courseId) || !safeId.test(lessonId)) {
        return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    // 1. التحقق من التسجيل ونشاط الحساب (تخطي للمسؤول والمدرس صاحب الكورس)
    if (user.role !== "admin") {
        const courseRef = adminDb.doc(`courses/${courseId}`);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }
        const isInstructor = courseSnap.data()?.instructor_id === user.uid;

        if (!isInstructor) {
            const enrollmentRef = adminDb.doc(`enrollments/${user.uid}_${courseId}`);
            const enrollmentSnap = await enrollmentRef.get();

            if (!enrollmentSnap.exists) {
                return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
            }
            const enrData = enrollmentSnap.data();
            if (enrData?.status !== "active") {
                return NextResponse.json({ error: "Enrollment inactive or suspended" }, { status: 403 });
            }
        }
    }

    // 2. جلب مسار الوسائط الحساس من courses/{courseId}/private/media مع دعم التوافق
    try {
        let videoPath: string | null = null;

        const privateMediaSnap = await adminDb.doc(`courses/${courseId}/private/media`).get();
        if (privateMediaSnap.exists) {
            const mediaData = privateMediaSnap.data() || {};
            const lessonMedia = mediaData[lessonId];
            if (lessonMedia) {
                videoPath = typeof lessonMedia === "string" ? lessonMedia : (lessonMedia.video_path || lessonMedia.url || null);
            }
        }

        // Fallback to course document modules
        if (!videoPath) {
            const courseRef = adminDb.doc(`courses/${courseId}`);
            const courseSnap = await courseRef.get();
            if (!courseSnap.exists) {
                return NextResponse.json({ error: "Course not found" }, { status: 404 });
            }
            const courseData = courseSnap.data();
            const modules = courseData?.modules || [];

            for (const module of modules) {
                for (const lesson of module.lessons || []) {
                    if (lesson.id?.toString() === lessonId?.toString()) {
                        videoPath = lesson.video_path || lesson.url || null;
                        break;
                    }
                }
                if (videoPath !== null) break;
            }
        }

        if (!videoPath) {
            return NextResponse.json({ error: "Lesson media not found" }, { status: 404 });
        }

        // 3. توكن قصير الأجل (15 دقيقة / 900 ثانية فقط)
        const expirationSeconds = 900;
        const expiration = Math.floor(Date.now() / 1000) + expirationSeconds;

        const youtubeId = extractYouTubeId(videoPath);

        if (youtubeId) {
            const token = obfuscate(youtubeId);
            return NextResponse.json({
                type: "youtube",
                token,
                origin: new URL(request.url).origin,
            });
        } else if (videoPath.includes("drive.google.com")) {
            const drivePreview = videoPath.replace(/\/view(\?.*)?$/, "/preview").replace(/\/edit(\?.*)?$/, "/preview");
            return NextResponse.json({ type: "drive", url: drivePreview });
        } else if (videoPath.startsWith("bunny_stream://")) {
            const guid = videoPath.split("://")[1];
            const securityKey = BUNNY_CONFIG.SECURITY_KEY;
            const libraryId = BUNNY_CONFIG.VIDEO_LIBRARY_ID;
            
            if (!securityKey || !libraryId) {
                return NextResponse.json({ error: "Video configuration missing" }, { status: 500 });
            }
            
            const tokenInput = securityKey + guid + expiration.toString();
            const token = crypto.createHash('sha256').update(tokenInput).digest('hex');
            const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?token=${token}&expires=${expiration}&autoplay=true`;
            
            return NextResponse.json({ 
                type: "stream", 
                url: embedUrl,
                guid: guid
            });
        } else if (videoPath.startsWith("http")) {
            let finalUrl = videoPath;
            if (videoPath.includes("b-cdn.net")) {
                const securityKey = BUNNY_CONFIG.SECURITY_KEY;
                if (securityKey) {
                    finalUrl = signBunnyUrl(videoPath, securityKey, expirationSeconds); 
                }
            }
            return NextResponse.json({ type: "direct", url: finalUrl });
        } else {
            return NextResponse.json({ error: "Unknown video type" }, { status: 422 });
        }
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
