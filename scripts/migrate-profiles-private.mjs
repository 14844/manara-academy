#!/usr/bin/env node
/**
 * Migration script: Move sensitive profile fields from profiles/{uid} to profiles_private/{uid}
 * and remove them from profiles/{uid} after successful write.
 *
 * Usage:
 *   node scripts/migrate-profiles-private.mjs          # dry-run mode (default)
 *   node scripts/migrate-profiles-private.mjs --apply  # actual migration mode
 */

import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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
    console.log("🔍 DRY-RUN mode (pass --apply to execute actual changes)\n");
} else {
    console.log("⚡ APPLY mode — writing to Firestore & deleting moved fields\n");
}

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

const SENSITIVE_FIELDS = [
    "email",
    "phone",
    "parent_phone",
    "wallet_balance",
    "active_devices",
    "active_session_id",
    "status",
    "student_id",
];

async function migrate() {
    console.log("Fetching profiles and existing private profiles from Firestore...");
    const [profilesSnap, privateSnap] = await Promise.all([
        db.collection("profiles").get(),
        db.collection("profiles_private").get(),
    ]);

    const totalUsers = profilesSnap.size;
    console.log(`Found ${totalUsers} user profile documents in total.\n`);

    // Map of existing private documents
    const existingPrivateMap = new Map();
    privateSnap.docs.forEach((doc) => {
        existingPrivateMap.set(doc.id, doc.data());
    });

    let migratedCount = 0;
    let upToDateCount = 0;
    let autoActivatedCount = 0;
    const usersMissingStatus = [];
    const failedUsers = [];

    for (const docSnap of profilesSnap.docs) {
        const uid = docSnap.id;
        const data = docSnap.data();
        const existingPrivate = existingPrivateMap.get(uid) || {};

        const privatePayload = {};
        const fieldsToDelete = {};

        // Migrate sensitive fields without overwriting newer/existing values in profiles_private
        for (const field of SENSITIVE_FIELDS) {
            if (data[field] !== undefined) {
                // If profiles_private does not have this field yet, copy it
                if (existingPrivate[field] === undefined) {
                    privatePayload[field] = data[field];
                }
                // Mark for deletion from profiles
                fieldsToDelete[field] = FieldValue.delete();
            }
        }

        // Status check: find effective status
        const effectiveStatus = existingPrivate.status ?? data.status;
        const role = data.role || "student";

        if (!effectiveStatus) {
            usersMissingStatus.push({ uid, role, email: data.email || existingPrivate.email || "N/A" });

            // If user is admin or instructor and missing status, set status: "active"
            if (role === "admin" || role === "instructor") {
                privatePayload.status = "active";
                autoActivatedCount++;
                console.log(`[User ${uid}] Auto-activating status: "active" for role: ${role}`);
            }
        }

        const keysToMove = Object.keys(privatePayload);
        const keysToDelete = Object.keys(fieldsToDelete);

        if (keysToMove.length === 0 && keysToDelete.length === 0) {
            upToDateCount++;
            continue;
        }

        console.log(`[User ${uid}] Fields to write to profiles_private: [${keysToMove.join(", ")}], Fields to delete from profiles: [${keysToDelete.join(", ")}]`);

        if (isDryRun) {
            migratedCount++;
        } else {
            try {
                // 1. Write to profiles_private/{uid} first (only missing or updated fields)
                if (keysToMove.length > 0) {
                    const privateRef = db.collection("profiles_private").doc(uid);
                    await privateRef.set(
                        {
                            ...privatePayload,
                            updated_at: new Date().toISOString(),
                        },
                        { merge: true }
                    );
                }

                // 2. Only after private write succeeds, remove sensitive fields from profiles/{uid}
                if (keysToDelete.length > 0) {
                    await docSnap.ref.update(fieldsToDelete);
                }

                migratedCount++;
                console.log(`  ✓ Successfully processed user ${uid}`);
            } catch (err) {
                console.error(`  ✗ FAILED for user ${uid}:`, err.message);
                failedUsers.push({ uid, error: err.message });
            }
        }
    }

    console.log("\n================ MIGRATION SUMMARY ================");
    console.log(`Total users scanned:                   ${totalUsers}`);
    console.log(`Already up to date:                   ${upToDateCount}`);
    console.log(`${isDryRun ? "Users requiring migration/update:    " : "Users successfully migrated/updated: "} ${migratedCount}`);
    console.log(`Admins/Instructors auto-activated:    ${autoActivatedCount}`);
    console.log(`Users missing status count:           ${usersMissingStatus.length}`);
    console.log(`Failed users count:                   ${failedUsers.length}`);

    if (usersMissingStatus.length > 0) {
        console.log("\n--- List of users missing status ---");
        usersMissingStatus.forEach((u) => {
            console.log(` - UID: ${u.uid} | Role: ${u.role} | Email: ${u.email}`);
        });
    }

    if (failedUsers.length > 0) {
        console.log("\n--- List of failed users ---");
        failedUsers.forEach((f) => console.log(` - UID: ${f.uid} | Error: ${f.error}`));
    }
    console.log("===================================================\n");
}

migrate().catch((err) => {
    console.error("Migration fatal error:", err);
    process.exit(1);
});
