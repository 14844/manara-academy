import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";

/**
 * POST /api/courses/save-media
 * Secure server-side endpoint for instructors to save both:
 * 1. Course structure and modules (extracting sensitive video_path/url and exam answers into private subcollection)
 * 2. Course details (title, description, category, grade_level, thumbnail_url, price)
 * Body: { courseId, modules, courseDetails?, idToken? }
 */
export async function POST(request: Request) {
    try {
        let user = await getServerAuth(request);

        const body = await request.json().catch(() => ({}));
        const { courseId, modules, courseDetails, idToken } = body;

        // Fallback to idToken if session cookie is absent or expired
        if (!user && idToken && typeof idToken === "string") {
            try {
                const decoded = await adminAuth.verifyIdToken(idToken);
                const [profileDoc, privateDoc] = await Promise.all([
                    adminDb.collection("profiles").doc(decoded.uid).get(),
                    adminDb.collection("profiles_private").doc(decoded.uid).get(),
                ]);
                const profileData = profileDoc.data() || {};
                const privateData = privateDoc.data() || {};
                user = {
                    uid: decoded.uid,
                    email: decoded.email || privateData.email || "",
                    role: (profileData.role as any) || "instructor",
                    status: privateData.status || profileData.status || "active",
                    profile: { ...profileData, ...privateData },
                };
            } catch (tokenErr) {
                console.error("Token verification error in save-media:", tokenErr);
            }
        }

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
        const examAnswersMap: Record<string, Record<string, any>> = {};

        const cleanModules = modules.map((mod: any) => ({
            ...mod,
            lessons: (mod.lessons || []).map((lesson: any) => {
                const lessonId = lesson.id?.toString();
                if (lessonId) {
                    const media: any = { ...(mediaMap[lessonId] || {}) };
                    if (lesson.video_path !== undefined) {
                        if (lesson.video_path) media.video_path = lesson.video_path;
                        else delete media.video_path;
                    }
                    if (lesson.url !== undefined) {
                        if (lesson.url) media.url = lesson.url;
                        else delete media.url;
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
                const enrolledCount = Number(courseData?.students_count || 0);
                // Allow price changes if admin or 0 enrolled students
                if (user.role === "admin" || enrolledCount === 0) {
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
