#!/usr/bin/env node
/**
 * One-time migration script: move video_path/url from public course documents
 * to courses/{id}/private/media subcollection.
 *
 * Usage:
 *   node scripts/migrate-course-media.mjs              # dry-run (default)
 *   node scripts/migrate-course-media.mjs --apply       # actually write
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY env var.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const isDryRun = !process.argv.includes("--apply");
if (isDryRun) {
    console.log("🔍 DRY-RUN mode (pass --apply to write changes)\n");
} else {
    console.log("⚡ APPLY mode — writing to Firestore\n");
}

// Initialize Firebase Admin
if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccount) {
        initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } else {
        // Falls back to GOOGLE_APPLICATION_CREDENTIALS
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
        let hasMedia = false;

        const cleanModules = modules.map((mod) => ({
            ...mod,
            lessons: (mod.lessons || []).map((lesson) => {
                const lessonId = lesson.id?.toString();
                if (!lessonId) return lesson;

                const media = {};
                if (lesson.video_path) {
                    media.video_path = lesson.video_path;
                    hasMedia = true;
                }
                if (lesson.url && (lesson.type === "video" || !lesson.type)) {
                    media.url = lesson.url;
                    hasMedia = true;
                }
                if (Object.keys(media).length > 0) {
                    mediaMap[lessonId] = media;
                }

                // Strip video media from public lesson (keep url for file-type lessons)
                const { video_path, url, ...rest } = lesson;
                if (lesson.type === "file" && url) {
                    return { ...rest, url };
                }
                return rest;
            }),
        }));

        if (!hasMedia) {
            skipped++;
            continue;
        }

        console.log(`  Course ${courseId}: ${Object.keys(mediaMap).length} lessons with media`);

        if (!isDryRun) {
            const batch = db.batch();
            batch.set(db.doc(`courses/${courseId}/private/media`), mediaMap, { merge: true });
            batch.update(db.doc(`courses/${courseId}`), { modules: cleanModules });
            await batch.commit();
        }

        migrated++;
    }

    console.log(`\n✅ Done. Migrated: ${migrated}, Skipped (no media): ${skipped}`);
    if (isDryRun) {
        console.log("   Re-run with --apply to commit changes.");
    }
}

migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
