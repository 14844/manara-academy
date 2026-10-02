import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function findUids() {
  const targetIds = ["MANARA-1017", "MANARA-1016", "MANARA-1004"];
  console.log("Searching for UIDs for:", targetIds);

  for (const id of targetIds) {
    const snapshot = await db.collection('profiles').where('student_id', '==', id).get();
    if (snapshot.empty) {
      console.log(`No profile found for ${id}`);
      // Try lowercase just in case
      const snapLower = await db.collection('profiles').where('student_id', '==', id.toLowerCase()).get();
       if (!snapLower.empty) {
         console.log(`Found ${id} (lowercase) UID: ${snapLower.docs[0].id}`);
       }
    } else {
      console.log(`Found ${id} UID: ${snapshot.docs[0].id}`);
    }
  }
}

findUids().catch(console.error);
