import dotenv from 'dotenv';
dotenv.config();

const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.FIREBASE_PROJECT_ID;

let db: any;

if (DEMO_MODE) {
  // Use in-memory database for demo
  const { demoDB } = await import('./demoDb.js');
  db = demoDB;
  console.log('🟡 Running in DEMO MODE (in-memory database)');
} else {
  // Use real Firebase
  const admin = await import('firebase-admin');
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  if (!admin.default.apps.length) {
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount as any),
    });
  }
  db = admin.default.firestore();
  console.log('🟢 Connected to Firebase Firestore');
}

export { db };
export default db;
