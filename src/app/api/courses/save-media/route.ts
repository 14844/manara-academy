import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";

/**
 * POST /api/courses/save-media
 * Saves video_path/url from lessons into courses/{courseId}/private/media
 * and strips them from the public course document.
 * Body: { courseId, modules }
 */
export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user || user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, modules } = body;

    if (!courseId || !/^[\w-]+$/.test(courseId)) {
        return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
    }
    if (!Array.isArray(modules)) {
        return NextResponse.json({ error: "Invalid modules" }, { status: 400 });
    }

    // Verify the user owns this course or is admin
    const courseRef = adminDb.doc(`courses/${courseId}`);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const courseData = courseSnap.data();
    if (user.role !== "admin" && courseData?.instructor_id !== user.uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Extract media paths and exam correct answers from lessons into private maps
    const mediaMap: Record<string, { video_path?: string; url?: string }> = {};
    const examAnswersMap: Record<string, Record<string, any>> = {};

    const cleanModules = modules.map((mod: any) => ({
        ...mod,
        lessons: (mod.lessons || []).map((lesson: any) => {
            const lessonId = lesson.id?.toString();
            if (lessonId) {
                const media: any = {};
                if (lesson.video_path) media.video_path = lesson.video_path;
                if (lesson.url) media.url = lesson.url;
                if (Object.keys(media).length > 0) {
                    mediaMap[lessonId] = media;
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

    // Write private media
    const mediaRef = adminDb.doc(`courses/${courseId}/private/media`);
    batch.set(mediaRef, mediaMap, { merge: true });

    // Write private exam answers if any
    if (Object.keys(examAnswersMap).length > 0) {
        const answersRef = adminDb.doc(`courses/${courseId}/private/exam_answers`);
        batch.set(answersRef, examAnswersMap, { merge: true });
    }

    // Update public course document with cleaned modules
    batch.update(courseRef, {
        modules: cleanModules,
        updated_at: new Date().toISOString(),
    });

    await batch.commit();

    return NextResponse.json({ success: true });
}
