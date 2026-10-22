#!/usr/bin/env node
/**
 * Migration script: move video_path, url, file_path, correctAnswer, answers
 * from public course documents to courses/{id}/private/media and courses/{id}/private/exam_answers.
 *
 * Usage:
 *   node scripts/migrate-course-media.mjs              # dry-run (default)
 *   node scripts/migrate-course-media.mjs --apply       # write changes to Firestore
 */

import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// Try loading .env.local if present
try {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
        const envLocalContent = fs.readFileSync(envLocalPath, "utf-8");
        envLocalContent.split("\n").forEach((line) => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value;
            }
        });
    }
} catch {
    // Ignore .env.local read errors
}

const isDryRun = !process.argv.includes("--apply");
if (isDryRun) {
    console.log("🔍 DRY-RUN mode (pass --apply to write changes)\n");
} else {
    console.log("⚡ APPLY mode — writing changes to Firestore\n");
}

// Initialize Firebase Admin
if (!getApps().length) {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
        });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
    } else {
        initializeApp();
    }
}

const db = getFirestore();

async function migrate() {
    const coursesSnap = await db.collection("courses").get();
    let migrated = 0;
    let skipped = 0;

    for (const courseDoc of coursesSnap.docs) {
        const courseId = courseDoc.id;
        const data = courseDoc.data();
        const modules = data.modules || [];

        const mediaMap = {};
        const examAnswersMap = {};
        let needsMigration = false;

        const cleanModules = modules.map((mod) => ({
            ...mod,
            lessons: (mod.lessons || []).map((lesson) => {
                const lessonId = lesson.id?.toString();
                if (!lessonId) return lesson;

                const media = {};
                if (lesson.video_path) {
                    media.video_path = lesson.video_path;
                    needsMigration = true;
                }
                if (lesson.url) {
                    media.url = lesson.url;
                    needsMigration = true;
                }
                if (lesson.file_path) {
                    media.file_path = lesson.file_path;
                    needsMigration = true;
                }
                if (Object.keys(media).length > 0) {
                    mediaMap[lessonId] = media;
                }

                let cleanQuestions = lesson.questions;
                if (Array.isArray(lesson.questions) && lesson.questions.length > 0) {
                    cleanQuestions = lesson.questions.map((q) => {
                        if (q && q.id !== undefined && (q.correctAnswer !== undefined || q.answers !== undefined)) {
                            if (!examAnswersMap[lessonId]) examAnswersMap[lessonId] = {};
                            examAnswersMap[lessonId][q.id] = q.correctAnswer ?? q.answers;
                            needsMigration = true;
                        }
                        const { correctAnswer, answers, ...safeQ } = q || {};
                        return safeQ;
                    });
                }

                // Completely strip sensitive media and answer keys from the public doc
                const { video_path, url, file_path, correctAnswer, answers, ...rest } = lesson;
                return {
                    ...rest,
                    ...(cleanQuestions ? { questions: cleanQuestions } : {}),
                };
            }),
        }));

        if (!needsMigration) {
            skipped++;
            continue;
        }

        console.log(`  Course [${courseId}] "${data.title || 'Untitled'}":`);
        console.log(`    - Media lessons to isolate: ${Object.keys(mediaMap).length}`);
        console.log(`    - Exam lessons with answers to isolate: ${Object.keys(examAnswersMap).length}`);

        if (!isDryRun) {
            const batch = db.batch();
            if (Object.keys(mediaMap).length > 0) {
                batch.set(db.doc(`courses/${courseId}/private/media`), mediaMap, { merge: true });
            }
            if (Object.keys(examAnswersMap).length > 0) {
                batch.set(db.doc(`courses/${courseId}/private/exam_answers`), examAnswersMap, { merge: true });
            }
            batch.update(db.doc(`courses/${courseId}`), {
                modules: cleanModules,
                updated_at: new Date().toISOString(),
            });
            await batch.commit();
        }

        migrated++;
    }

    console.log(`\n✅ Summary: Migrated: ${migrated}, Skipped (already clean): ${skipped}`);
    if (isDryRun) {
        console.log("   Dry-run complete. Re-run with --apply to commit changes to Firestore.");
    }
}

migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
