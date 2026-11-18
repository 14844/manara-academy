import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
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
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

const db = getFirestore();

// Initialize Supabase if credentials exist
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function wipeCollection(colName) {
  console.log(`\n--- Cleaning collection: [${colName}] ---`);
  const snapshot = await db.collection(colName).get();
  if (snapshot.empty) {
    console.log(`  No documents found in ${colName}.`);
    return 0;
  }
  
  let deletedCount = 0;
  const batchSize = 100;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    // Check for any subcollections
    const subcols = await doc.ref.listCollections();
    for (const subcol of subcols) {
      const subSnap = await subcol.get();
      for (const subDoc of subSnap.docs) {
        batch.delete(subDoc.ref);
        count++;
      }
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

  console.log(`  Deleted ${deletedCount} documents from [${colName}].`);
  return deletedCount;
}

async function resetUserProfiles() {
  console.log(`\n--- Resetting financial & learning stats in [profiles] ---`);
  const profilesSnap = await db.collection('profiles').get();
  console.log(`  Found ${profilesSnap.size} user profiles to preserve & reset.`);

  let updatedCount = 0;
  const batchSize = 100;
  let batch = db.batch();
  let count = 0;

  for (const doc of profilesSnap.docs) {
    const data = doc.data();
    batch.update(doc.ref, {
      wallet_balance: 0,
      total_earned: 0,
      total_spent: 0,
      total_revenue: 0,
      balance: 0,
      earnings: 0,
      enrolled_courses: [],
      completed_courses: [],
      updated_at: new Date().toISOString()
    });
    count++;
    updatedCount++;

    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`  Successfully zeroed stats for ${updatedCount} profiles while keeping accounts intact.`);
}

async function cleanSupabaseStorage() {
  if (!supabase) {
    console.log('\nSupabase not configured, skipping storage cleanup.');
    return;
  }
  console.log(`\n--- Checking Supabase Storage Buckets ---`);
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn('  Could not list Supabase buckets:', error.message);
      return;
    }
    if (!buckets || buckets.length === 0) {
      console.log('  No buckets found.');
      return;
    }
    for (const b of buckets) {
      console.log(`  Checking bucket: ${b.name}`);
      const { data: files, error: listErr } = await supabase.storage.from(b.name).list();
      if (listErr) {
        console.warn(`    Error listing files in ${b.name}:`, listErr.message);
        continue;
      }
      if (files && files.length > 0) {
        const fileNames = files.map(f => f.name);
        const { error: delErr } = await supabase.storage.from(b.name).remove(fileNames);
        if (delErr) {
          console.warn(`    Error deleting files in ${b.name}:`, delErr.message);
        } else {
          console.log(`    Deleted ${fileNames.length} files from bucket ${b.name}.`);
        }
      } else {
        console.log(`    Bucket ${b.name} is empty.`);
      }
    }
  } catch (err) {
    console.warn('  Supabase storage cleanup error:', err.message);
  }
}

async function main() {
  console.log("==================================================");
  console.log("   MANARA ACADEMY - COMPLETE DATA RESET SCRIPT    ");
  console.log("==================================================");

  // 1. List all collections in Firestore
  const collections = await db.listCollections();
  console.log(`Found collections in Firestore: ${collections.map(c => c.id).join(', ')}`);

  // Target collections to completely wipe (everything except profiles)
  const collectionsToWipe = [
    'courses',
    'enrollments',
    'transactions',
    'wallet_requests',
    'withdrawal_requests',
    'submissions',
    'parent_reports',
    'report_schedules',
    'coupons',
    'video_progress',
    'settlements',
    'quizzes',
    'lessons',
    'assignments',
    'notifications',
    'support_tickets',
    'activities'
  ];

  for (const col of collections) {
    if (col.id !== 'profiles') {
      await wipeCollection(col.id);
    }
  }

  // Ensure any other predefined collection that might have been empty/absent is wiped if present
  for (const colName of collectionsToWipe) {
    if (!collections.some(c => c.id === colName)) {
      await wipeCollection(colName);
    }
  }

  // 2. Reset Profiles financial numbers & course enrollments to 0
  await resetUserProfiles();

  // 3. Clean Supabase Storage
  await cleanSupabaseStorage();

  console.log("\n==================================================");
  console.log("   DATA RESET COMPLETED SUCCESSFULLY!            ");
  console.log("==================================================");
}

main().catch(err => {
  console.error("FATAL ERROR during reset:", err);
  process.exit(1);
});
