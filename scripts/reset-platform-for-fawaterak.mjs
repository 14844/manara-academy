import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function wipeCollection(colName) {
  const snapshot = await db.collection(colName).get();
  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;
  const batchSize = 100;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    // Delete any subcollections recursively
    try {
      const subcols = await doc.ref.listCollections();
      for (const subcol of subcols) {
        const subSnap = await subcol.get();
        for (const subDoc of subSnap.docs) {
          batch.delete(subDoc.ref);
          count++;
        }
      }
    } catch (e) {
      // Subcollections listing not critical if none exist
    }

    batch.delete(doc.ref);
    count++;
    deletedCount++;

    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return deletedCount;
}

async function resetProfiles() {
  const [profilesSnap, privateSnap] = await Promise.all([
    db.collection('profiles').get(),
    db.collection('profiles_private').get(),
  ]);

  let batch = db.batch();
  let count = 0;

  for (const doc of profilesSnap.docs) {
    batch.update(doc.ref, {
      wallet_balance: 0,
      total_earned: 0,
      total_spent: 0,
      total_revenue: 0,
      balance: 0,
      earnings: 0,
      enrolled_courses: [],
      completed_courses: [],
      updated_at: new Date().toISOString(),
    });
    count++;
    if (count >= 100) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  for (const doc of privateSnap.docs) {
    batch.update(doc.ref, {
      wallet_balance: 0,
      balance: 0,
      total_earned: 0,
      total_spent: 0,
      updated_at: new Date().toISOString(),
    });
    count++;
    if (count >= 100) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return {
    profiles: profilesSnap.size,
    private: privateSnap.size,
  };
}

async function cleanStorageFolders() {
  const foldersToClear = ['payment_proofs', 'thumbnails', 'questions', 'files', 'videos'];
  const results = {};

  for (const folder of foldersToClear) {
    try {
      const { data: files, error } = await supabaseAdmin.storage.from('manara-academy').list(folder);
      if (error || !files || files.length === 0) {
        results[folder] = 0;
        continue;
      }

      const filePaths = files.map(f => `${folder}/${f.name}`);
      const { error: delErr } = await supabaseAdmin.storage.from('manara-academy').remove(filePaths);
      if (delErr) {
        console.warn(`Error deleting files in ${folder}:`, delErr.message);
        results[folder] = 0;
      } else {
        results[folder] = filePaths.length;
      }
    } catch (err) {
      results[folder] = 0;
    }
  }

  return results;
}

async function run() {
  console.log("==================================================");
  console.log("   CLEANING & ZEROING PLATFORM FOR REVIEW       ");
  console.log("==================================================");

  // Collections to wipe completely
  const collectionsToWipe = [
    'courses',
    'enrollments',
    'course_orders',
    'wallet_requests',
    'withdrawal_requests',
    'transactions',
    'activity_logs',
    'server_activities',
    'coupons',
    'submissions',
    'video_progress',
    'report_schedules',
    'parent_reports',
    'notifications',
    'activities',
    'quizzes',
    'lessons',
  ];

  const wipedResults = {};
  for (const col of collectionsToWipe) {
    const deleted = await wipeCollection(col);
    if (deleted > 0) {
      wipedResults[col] = deleted;
      console.log(`[x] Wiped collection [${col}]: ${deleted} documents deleted`);
    }
  }

  // Check any other collection that is not profiles, profiles_private, settings, system
  const allCols = await db.listCollections();
  const preserve = new Set(['profiles', 'profiles_private', 'settings', 'system']);
  for (const c of allCols) {
    if (!preserve.has(c.id) && !wipedResults[c.id]) {
      const deleted = await wipeCollection(c.id);
      if (deleted > 0) {
        wipedResults[c.id] = deleted;
        console.log(`[x] Wiped additional collection [${c.id}]: ${deleted} documents deleted`);
      }
    }
  }

  // Reset profiles
  console.log("\n[*] Resetting financial balances & courses for all user accounts...");
  const resetStats = await resetProfiles();
  console.log(`[✓] Zeroed balances for ${resetStats.profiles} public profiles & ${resetStats.private} private profiles.`);

  // Clean storage assets (except avatars)
  console.log("\n[*] Cleaning course media & proof files in Supabase Storage...");
  const storageResults = await cleanStorageFolders();
  for (const [folder, count] of Object.entries(storageResults)) {
    console.log(`[✓] Folder [${folder}]: deleted ${count} files`);
  }

  console.log("\n==================================================");
  console.log("   PLATFORM CLEANUP COMPLETED SUCCESSFULLY!       ");
  console.log("==================================================");
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
