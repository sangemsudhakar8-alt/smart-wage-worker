import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { existsSync, readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv from root first, then backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'smart-wage';
const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

let app;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket
    });
    console.log("Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT environment variable.");
  } else {
    // Check for local serviceAccountKey.json first, then GOOGLE_APPLICATION_CREDENTIALS
    const localKeyPath = path.resolve(__dirname, '../serviceAccountKey.json');
    const credPath = existsSync(localKeyPath)
      ? localKeyPath
      : process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
        : null;

    if (credPath && existsSync(credPath)) {
      const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
      app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket
      });
      console.log(`Firebase Admin initialized via ${credPath === localKeyPath ? 'local serviceAccountKey.json' : 'GOOGLE_APPLICATION_CREDENTIALS'}.`);
    } else {
      // Fallback/Default initialization
      app = initializeApp({
        projectId,
        storageBucket
      });
      console.log(`Firebase Admin initialized with Project ID: ${projectId} (Default Credentials).`);
    }
  }
} catch (error) {
  if (!/already exists/.test(error.message)) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
  app = getApp();
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Helper to determine if we are in dev mode
export const isDevMode = process.env.NODE_ENV !== 'production';

// Re-export for backwards compatibility with code that imports `admin`
import admin from 'firebase-admin';
export default admin;
