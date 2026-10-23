import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { BUNNY_CONFIG } from "@/lib/bunny/config";
import { getServerAuth } from "@/lib/server-auth";
import crypto from "crypto";
import { BUNNY_GUID_RE, extractStoragePath, isCourseScopedPath } from "@/lib/media-security";

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
            // Match lessonId as string, as number, or fuzzy key
            const matchKey = Object.keys(mediaData).find(k => k?.toString() === lessonId?.toString());
            const lessonMedia = matchKey ? mediaData[matchKey] : mediaData[lessonId];
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

        // Decode and normalize videoPath if it was wrapped in /api/storage/sign or similar
        let rawPath = videoPath.trim();
        if (rawPath.includes("/api/storage/sign") || rawPath.includes("storage/sign?")) {
            try {
                const parsed = new URL(rawPath, "https://placeholder.local");
                const extracted = parsed.searchParams.get("url") || parsed.searchParams.get("path");
                if (extracted) {
                    rawPath = decodeURIComponent(extracted);
                }
            } catch {
                const match = rawPath.match(/[?&](?:url|path)=([^&]+)/);
                if (match) rawPath = decodeURIComponent(match[1]);
            }
        }

        // 3. توكن قصير الأجل (15 دقيقة / 900 ثانية فقط)
        const expirationSeconds = 900;
        const expiration = Math.floor(Date.now() / 1000) + expirationSeconds;

        const youtubeId = extractYouTubeId(rawPath);

        const isSupabase = rawPath.startsWith("supabase://") ||
            rawPath.includes("supabase.co") ||
            rawPath.startsWith("videos/") ||
            rawPath.startsWith("files/") ||
            rawPath.startsWith("courses/") ||
            rawPath.startsWith("/videos/") ||
            rawPath.startsWith("/files/");

        if (youtubeId) {
            const token = obfuscate(youtubeId);
            return NextResponse.json({
                type: "youtube",
                token,
                embed: true,
                origin: new URL(request.url).origin,
            });
        } else if (rawPath.includes("drive.google.com")) {
            // Extract file ID to prevent leaking any raw query strings or view parameters
            const match = rawPath.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawPath.match(/id=([a-zA-Z0-9_-]+)/);
            const fileId = match ? match[1] : null;
            const driveEmbedUrl = fileId 
                ? `https://drive.google.com/file/d/${fileId}/preview`
                : rawPath.replace(/\/view(\?.*)?$/, "/preview").replace(/\/edit(\?.*)?$/, "/preview");
            return NextResponse.json({ type: "drive", url: driveEmbedUrl, embed: true });
        } else if (isSupabase) {
            // Security: only our own Supabase project, and only paths inside THIS course's folders
            const { supabaseAdmin, SUPABASE_BUCKET } = await import("@/lib/supabase/admin");
            const cleanStoragePath = extractStoragePath(rawPath, SUPABASE_BUCKET);
            if (!cleanStoragePath || !isCourseScopedPath(cleanStoragePath, courseId)) {
                return NextResponse.json({ error: "الملف لا ينتمي لهذا الكورس" }, { status: 403 });
            }

            const { data: signedData, error: signErr } = await supabaseAdmin.storage
                .from(SUPABASE_BUCKET)
                .createSignedUrl(cleanStoragePath, expirationSeconds);

            if (signErr || !signedData?.signedUrl) {
                console.error("Supabase createSignedUrl error:", signErr);
                return NextResponse.json({ error: "فشل إنشاء رابط الفيديو الآمن" }, { status: 500 });
            }

            return NextResponse.json({ type: "direct", url: signedData.signedUrl });
        } else if (rawPath.startsWith("bunny_stream://")) {
            const guid = rawPath.split("://")[1];
            if (!BUNNY_GUID_RE.test(guid)) {
                return NextResponse.json({ error: "Invalid stream identifier" }, { status: 400 });
            }

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
        } else {
            return NextResponse.json({ error: "Unknown video type" }, { status: 422 });
        }
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
