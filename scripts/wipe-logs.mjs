import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function clearLogs() {
  console.log('Fetching activity_logs...');
  const snapshot = await db.collection('activity_logs').get();
  console.log(`Found ${snapshot.size} activity logs.`);

  if (snapshot.empty) {
    console.log('No logs to delete.');
    return;
  }

  const batchSize = 250;
  let batch = db.batch();
  let count = 0;
  let totalDeleted = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    totalDeleted++;

    if (count >= batchSize) {
      await batch.commit();
      console.log(`Deleted batch of ${count} logs...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Deleted final batch of ${count} logs...`);
  }

  console.log(`Successfully deleted ${totalDeleted} activity logs.`);
}

clearLogs().catch(err => {
  console.error('Error clearing logs:', err);
  process.exit(1);
});
