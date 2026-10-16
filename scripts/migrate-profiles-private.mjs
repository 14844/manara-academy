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
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccount) {
        initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
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
    console.log("Fetching profiles from Firestore...");
    const profilesSnap = await db.collection("profiles").get();
    const totalUsers = profilesSnap.size;
    console.log(`Found ${totalUsers} user profile documents in total.\n`);

    let migratedCount = 0;
    let upToDateCount = 0;
    const failedUsers = [];

    for (const docSnap of profilesSnap.docs) {
        const uid = docSnap.id;
        const data = docSnap.data();

        // Check which sensitive fields exist on profiles/{uid}
        const privatePayload = {};
        const fieldsToDelete = {};

        for (const field of SENSITIVE_FIELDS) {
            if (data[field] !== undefined) {
                privatePayload[field] = data[field];
                fieldsToDelete[field] = FieldValue.delete();
            }
        }

        const keysToMove = Object.keys(privatePayload);
        if (keysToMove.length === 0) {
            upToDateCount++;
            continue;
        }

        console.log(`[User ${uid}] Fields to migrate: ${keysToMove.join(", ")}`);

        if (isDryRun) {
            migratedCount++;
        } else {
            try {
                // 1. Write to profiles_private/{uid} first (merge to preserve any already existing data)
                const privateRef = db.collection("profiles_private").doc(uid);
                await privateRef.set(
                    {
                        ...privatePayload,
                        updated_at: new Date().toISOString(),
                    },
                    { merge: true }
                );

                // 2. Only after write succeeds, remove sensitive fields from profiles/{uid}
                await docSnap.ref.update(fieldsToDelete);

                migratedCount++;
                console.log(`  ✓ Successfully migrated and cleaned profiles/${uid}`);
            } catch (err) {
                console.error(`  ✗ FAILED for user ${uid}:`, err.message);
                failedUsers.push({ uid, error: err.message });
            }
        }
    }

    console.log("\n================ MIGRATION SUMMARY ================");
    console.log(`Total users scanned:        ${totalUsers}`);
    console.log(`Already up to date:        ${upToDateCount}`);
    console.log(`${isDryRun ? "Users requiring migration: " : "Users successfully migrated:"} ${migratedCount}`);
    console.log(`Failed users:              ${failedUsers.length}`);

    if (failedUsers.length > 0) {
        console.log("\nList of failed users:");
        failedUsers.forEach((f) => console.log(` - UID: ${f.uid} | Error: ${f.error}`));
    }
    console.log("===================================================\n");
}

migrate().catch((err) => {
    console.error("Migration fatal error:", err);
    process.exit(1);
});
