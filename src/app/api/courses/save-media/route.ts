import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { getServerAuth, getActiveServerAuth } from "@/lib/server-auth";
import { BUNNY_GUID_RE, extractStoragePath, isCourseScopedPath } from "@/lib/media-security";
import { SUPABASE_BUCKET } from "@/lib/supabase/admin";

/**
 * POST /api/courses/save-media
 * Secure server-side endpoint for instructors to save both:
 * 1. Course structure and modules (extracting sensitive video_path/url and exam answers into private subcollection)
 * 2. Course details (title, description, category, grade_level, thumbnail_url, price)
 * Body: { courseId, modules, courseDetails?, idToken? }
 */
export async function POST(request: Request) {
    try {
        const user = await getActiveServerAuth(request);

        const body = await request.json().catch(() => ({}));
        const { courseId, modules, courseDetails } = body;

        if (!user || user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "غير مصرح لك بتعديل هذا الكورس" }, { status: 401 });
        }

        if (!courseId || typeof courseId !== "string" || !/^[\w-]+$/.test(courseId)) {
            return NextResponse.json({ error: "معرّف الكورس غير صالح" }, { status: 400 });
        }
        if (!Array.isArray(modules)) {
            return NextResponse.json({ error: "هيكل الوحدات والدروس غير صالح" }, { status: 400 });
        }

        // Verify the user owns this course or is admin
        const courseRef = adminDb.doc(`courses/${courseId}`);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }
        const courseData = courseSnap.data() || {};
        if (user.role !== "admin" && courseData?.instructor_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بتعديل كورس لمعلم آخر" }, { status: 403 });
        }

        // Extract media paths and exam correct answers from lessons into private maps
        const existingMediaSnap = await adminDb.doc(`courses/${courseId}/private/media`).get();
        const existingMedia = existingMediaSnap.exists ? (existingMediaSnap.data() || {}) : {};

        const mediaMap: Record<string, { video_path?: string; url?: string }> = { ...existingMedia };
        // Bunny Stream GUIDs already attached to this course (legacy) may be kept/moved between lessons
        const knownBunny = new Set<string>();
        for (const v of Object.values(existingMedia)) {
            const vals = typeof v === "string" ? [v] : [(v as any)?.video_path, (v as any)?.url];
            for (const val of vals) {
                if (typeof val === "string" && val.startsWith("bunny_stream://")) {
                    knownBunny.add(val.slice("bunny_stream://".length).toLowerCase());
                }
            }
        }
        const examAnswersMap: Record<string, Record<string, any>> = {};

        const cleanModules = modules.map((mod: any) => ({
            ...mod,
            lessons: (mod.lessons || []).map((lesson: any) => {
                const lessonId = lesson.id?.toString();
                if (lessonId) {
                    const media: any = { ...(mediaMap[lessonId] || {}) };
                    if (lesson.video_path !== undefined) {
                        if (lesson.video_path) {
                            if (!isValidCourseMedia(lesson.video_path, courseId, knownBunny, user.role === "admin")) {
                                throw new Error(`مسار الفيديو للدرس (${lesson.title || lessonId}) غير صالح أو لا يخص هذا الكورس`);
                            }
                            media.video_path = lesson.video_path;
                        } else {
                            delete media.video_path;
                        }
                    }
                    if (lesson.url !== undefined) {
                        if (lesson.url) {
                            if (!isValidCourseMedia(lesson.url, courseId, knownBunny, user.role === "admin")) {
                                throw new Error(`رابط الملف للدرس (${lesson.title || lessonId}) غير صالح أو لا يخص هذا الكورس`);
                            }
                            media.url = lesson.url;
                        } else {
                            delete media.url;
                        }
                    }
                    if (Object.keys(media).length > 0) {
                        mediaMap[lessonId] = media;
                    } else {
                        delete mediaMap[lessonId];
                    }

                    if (Array.isArray(lesson.questions) && lesson.questions.length > 0) {
                        examAnswersMap[lessonId] = {};
                        lesson.questions = lesson.questions.map((q: any) => {
                            if (q && q.id !== undefined && (q.correctAnswer !== undefined || q.answers !== undefined)) {
                                examAnswersMap[lessonId][q.id] = q.correctAnswer ?? q.answers;
                            }
                            const { correctAnswer, answers, ...safeQ } = q || {};
                            return safeQ;
                        });
                    }
                }
                // Strip ALL sensitive media paths, URLs, and answers completely from the public document
                const { video_path, url, file_path, correctAnswer, answers, ...rest } = lesson;
                return rest;
            }),
        }));

        const batch = adminDb.batch();

        // 1. Write private media
        const mediaRef = adminDb.doc(`courses/${courseId}/private/media`);
        batch.set(mediaRef, mediaMap, { merge: true });

        // 2. Write private exam answers if any
        if (Object.keys(examAnswersMap).length > 0) {
            const answersRef = adminDb.doc(`courses/${courseId}/private/exam_answers`);
            batch.set(answersRef, examAnswersMap, { merge: true });
        }

        // 3. Prepare public course updates
        const courseUpdates: Record<string, any> = {
            modules: cleanModules,
            updated_at: new Date().toISOString(),
        };

        if (courseDetails && typeof courseDetails === "object") {
            if (typeof courseDetails.title === "string" && courseDetails.title.trim()) {
                courseUpdates.title = courseDetails.title.trim();
            }
            if (typeof courseDetails.description === "string") {
                courseUpdates.description = courseDetails.description.trim();
            }
            if (typeof courseDetails.category === "string" && courseDetails.category.trim()) {
                courseUpdates.category = courseDetails.category.trim();
            }
            if (typeof courseDetails.grade_level === "string" && courseDetails.grade_level.trim()) {
                courseUpdates.grade_level = courseDetails.grade_level.trim();
            }
            if (typeof courseDetails.thumbnail_url === "string") {
                courseUpdates.thumbnail_url = courseDetails.thumbnail_url;
            }
            if (courseDetails.price !== undefined && !isNaN(Number(courseDetails.price))) {
                const newPrice = Math.max(0, Number(courseDetails.price));
                // Item 7: Use total_sales (real cumulative count, never decremented) for price guard
                const totalSales = Math.max(Number(courseData?.total_sales || 0), Number(courseData?.students_count || 0));
                // Allow price changes if admin or no real sales ever occurred
                if (user.role === "admin" || totalSales === 0) {
                    courseUpdates.price = newPrice;
                }
            }
        }

        batch.update(courseRef, courseUpdates);

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: "تم حفظ الكورس ومحتواه بنجاح",
        });
    } catch (error: any) {
        console.error("Save course media error:", error);
        return NextResponse.json({ error: error.message || "حدث خطأ أثناء حفظ الكورس" }, { status: 500 });
    }
}

/**
 * GET /api/courses/save-media?courseId=...
 * Load course details and private media for instructor or admin management
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const courseId = searchParams.get("courseId");

        if (!courseId || typeof courseId !== "string" || !/^[\w-]+$/.test(courseId)) {
            return NextResponse.json({ error: "معرّف الكورس غير صالح" }, { status: 400 });
        }

        const user = await getServerAuth(request);
        if (!user || user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
        }

        const courseRef = adminDb.doc(`courses/${courseId}`);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }

        const courseData = courseSnap.data() || {};
        if (user.role !== "admin" && courseData?.instructor_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بإدارة هذا الكورس" }, { status: 403 });
        }

        // Fetch private media and answers
        const [mediaSnap, answersSnap] = await Promise.all([
            adminDb.doc(`courses/${courseId}/private/media`).get(),
            adminDb.doc(`courses/${courseId}/private/exam_answers`).get(),
        ]);

        const mediaData = mediaSnap.exists ? (mediaSnap.data() || {}) : {};
        const answersData = answersSnap.exists ? (answersSnap.data() || {}) : {};

        // Merge back into modules
        const mergedModules = (courseData.modules || []).map((mod: any) => ({
            ...mod,
            lessons: (mod.lessons || []).map((lesson: any) => {
                const lessonId = lesson.id?.toString();
                const lessonMedia = lessonId ? mediaData[lessonId] : null;
                const lessonAnswers = lessonId ? answersData[lessonId] : null;

                const restoredLesson = { ...lesson };
                if (lessonMedia) {
                    if (typeof lessonMedia === "string") {
                        restoredLesson.video_path = lessonMedia;
                    } else {
                        if (lessonMedia.video_path) restoredLesson.video_path = lessonMedia.video_path;
                        if (lessonMedia.url) restoredLesson.url = lessonMedia.url;
                    }
                }

                if (lessonAnswers && Array.isArray(restoredLesson.questions)) {
                    restoredLesson.questions = restoredLesson.questions.map((q: any) => {
                        const ans = lessonAnswers[q.id];
                        if (ans !== undefined) {
                            return { ...q, correctAnswer: ans };
                        }
                        return q;
                    });
                }

                return restoredLesson;
            }),
        }));

        return NextResponse.json({
            success: true,
            course: {
                ...courseData,
                id: courseId,
                modules: mergedModules,
            },
        });
    } catch (error: any) {
        console.error("GET course media error:", error);
        return NextResponse.json({ error: error.message || "حدث خطأ أثناء تحميل بيانات الكورس" }, { status: 500 });
    }
}

/**
 * A lesson media reference is accepted only if it points to:
 *  - YouTube / Google Drive (public embeds), or
 *  - a storage path inside THIS course's folders (our own Supabase project only), or
 *  - a Bunny Stream GUID already attached to this course (no mapping exists to prove ownership of new GUIDs;
 *    admins may attach new ones).
 * Everything else (payment_proofs, avatars, other courses, foreign hosts, arbitrary *.b-cdn.net) is rejected.
 */
function isValidCourseMedia(mediaPath: string, courseId: string, knownBunny: Set<string>, isAdmin: boolean): boolean {
    if (!mediaPath || typeof mediaPath !== "string") return false;
    const str = mediaPath.trim();
    if (str.includes("\0") || str.includes("..")) return false;

    if (str.startsWith("bunny_stream://")) {
        const guid = str.slice("bunny_stream://".length);
        if (!BUNNY_GUID_RE.test(guid)) return false;
        return isAdmin || knownBunny.has(guid.toLowerCase());
    }

    if (/^https?:\/\//i.test(str)) {
        let host = "";
        try { host = new URL(str).hostname.toLowerCase(); } catch { return false; }
        if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
            return /(youtu\.be\/|v\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]{11})/.test(str);
        }
        if (host === "drive.google.com") {
            return str.includes("/file/d/") || str.includes("id=");
        }
    }

    const storagePath = extractStoragePath(str, SUPABASE_BUCKET);
    return !!storagePath && isCourseScopedPath(storagePath, courseId);
}
