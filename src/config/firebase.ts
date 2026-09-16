import admin from "firebase-admin";
import { getApps } from "firebase-admin/app";
import fs from "fs";
import path from "path";

if (!getApps().length) {
  let credential;
  const keysPath = path.join(__dirname, "keys.json");

  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else if (fs.existsSync(keysPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keysPath, "utf8"));
    if (serviceAccount.private_key && typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    credential = admin.credential.cert(serviceAccount);
  } else {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || "suplicem-ce464",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "suplicem-ce464.firebasestorage.app",
  });
}

export const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });
export const auth = admin.auth();
export const storage = admin.storage();
