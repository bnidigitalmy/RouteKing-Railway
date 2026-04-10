
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

async function test() {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

  const app = admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });

  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  try {
    console.log(`Attempting to read from profiles/test_admin using Admin SDK...`);
    const doc = await db.collection('profiles').doc('test_admin').get();
    if (doc.exists) {
      console.log("Read successful! Data:", doc.data());
    } else {
      console.log("Read successful! Document does not exist.");
    }
  } catch (error) {
    console.error("Read failed:", error);
  }
}

test();
