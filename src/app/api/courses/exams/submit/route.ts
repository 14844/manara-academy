import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user || user.status === "blocked" || user.status === "suspended") {
        return NextResponse.json({ error: "غير مصرح لك بتسليم الاختبار" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { courseId, lessonId, type, answers } = body;

        if (!courseId || !lessonId) {
            return NextResponse.json({ error: "بيانات الاختبار غير مكتملة" }, { status: 400 });
        }

        // Verify active enrollment for this student
        const enrollmentRef = adminDb.collection("enrollments").doc(`${user.uid}_${courseId}`);
        const enrollmentSnap = await enrollmentRef.get();
        if (!enrollmentSnap.exists || enrollmentSnap.data()?.status !== "active") {
            return NextResponse.json({ error: "يجب أن تكون مسجلاً في الكورس لتسليم الاختبار" }, { status: 403 });
        }

        // Limit: Max 3 attempts per lesson for each student
        const priorSubsSnap = await adminDb
            .collection("submissions")
            .where("student_id", "==", user.uid)
            .where("course_id", "==", courseId)
            .where("lesson_id", "==", lessonId)
            .get();

        if (priorSubsSnap.size >= 3) {
            return NextResponse.json(
                { error: "لقد استنفدت الحد الأقصى للمحاولات (3 محاولات) لهذا الاختبار" },
                { status: 400 }
            );
        }

        // Fetch course and lesson questions
        const courseRef = adminDb.collection("courses").doc(courseId);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
        }

        const courseData = courseSnap.data()!;
        const instructorId = courseData.instructor_id;

        // Fetch private exam answers if stored
        const privateAnswersSnap = await adminDb.doc(`courses/${courseId}/private/exam_answers`).get();
        const privateAnswers = privateAnswersSnap.exists ? privateAnswersSnap.data() : {};
        const lessonAnswers = privateAnswers?.[lessonId.toString()] || {};

        // Find the lesson in modules
        let foundLesson: any = null;
        for (const mod of courseData.modules || []) {
            for (const l of mod.lessons || []) {
                if (l.id?.toString() === lessonId.toString()) {
                    foundLesson = l;
                    break;
                }
            }
            if (foundLesson) break;
        }

        const questions: any[] = foundLesson?.questions || [];
        let fullTotalPoints = 0;
        let fullEarnedPoints = 0;
        let mcqTotalPoints = 0;
        let mcqEarnedPoints = 0;
        let hasEssayQuestions = false;

        questions.forEach((q: any) => {
            const qPts = Number(q.points) || 1;
            fullTotalPoints += qPts;

            if (q.type === "essay") {
                hasEssayQuestions = true;
            } else {
                mcqTotalPoints += qPts;
                const correctAns = lessonAnswers[q.id?.toString()] ?? q.correctAnswer;
                if (correctAns !== undefined && answers?.[q.id] === correctAns) {
                    mcqEarnedPoints += qPts;
                    fullEarnedPoints += qPts;
                }
            }
        });

        const calculatedScore = hasEssayQuestions
            ? (mcqTotalPoints > 0 ? Math.round((mcqEarnedPoints / mcqTotalPoints) * 100) : 100)
            : (fullTotalPoints > 0 ? Math.round((fullEarnedPoints / fullTotalPoints) * 100) : 0);

        // Atomically enforce max 3 attempts using deterministic document IDs inside a transaction
        const submissionResult = await adminDb.runTransaction(async (t) => {
            const sub1Ref = adminDb.collection("submissions").doc(`${user.uid}_${lessonId}_1`);
            const sub2Ref = adminDb.collection("submissions").doc(`${user.uid}_${lessonId}_2`);
            const sub3Ref = adminDb.collection("submissions").doc(`${user.uid}_${lessonId}_3`);

            const [sub1Snap, sub2Snap, sub3Snap] = await Promise.all([
                t.get(sub1Ref),
                t.get(sub2Ref),
                t.get(sub3Ref),
            ]);

            let targetRef: FirebaseFirestore.DocumentReference;
            let attemptNumber: number;

            if (!sub1Snap.exists) {
                targetRef = sub1Ref;
                attemptNumber = 1;
            } else if (!sub2Snap.exists) {
                targetRef = sub2Ref;
                attemptNumber = 2;
            } else if (!sub3Snap.exists) {
                targetRef = sub3Ref;
                attemptNumber = 3;
            } else {
                throw new Error("MAX_ATTEMPTS_EXCEEDED");
            }

            t.set(targetRef, {
                id: targetRef.id,
                student_id: user.uid,
                student_name: user.profile?.full_name || user.email || "طالب",
                course_id: courseId,
                instructor_id: instructorId,
                lesson_id: lessonId,
                attempt: attemptNumber,
                type: type || "exam",
                score: calculatedScore,
                answers: answers || {},
                needs_grading: hasEssayQuestions,
                submitted_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
            });

            return { submissionId: targetRef.id, attemptNumber };
        });

        return NextResponse.json({
            success: true,
            score: calculatedScore,
            attempt: submissionResult.attemptNumber,
            max_attempts: 3,
            needs_grading: hasEssayQuestions,
            submissionId: submissionResult.submissionId,
        });
    } catch (err: any) {
        if (err.message === "MAX_ATTEMPTS_EXCEEDED") {
            return NextResponse.json(
                { error: "لقد استنفدت الحد الأقصى للمحاولات (3 محاولات) لهذا الاختبار" },
                { status: 400 }
            );
        }
        console.error("Exam submit error:", err);
        return NextResponse.json({ error: "فشل تسليم الاختبار" }, { status: 500 });
    }
}
