import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "energyos-bb7fd.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check which required variables are missing
const missingVars: string[] = [];
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Log clear error in development when Firebase is not configured
if (!isFirebaseConfigured && process.env.NODE_ENV === "development") {
  console.error(
    "[firebase] ⚠️ Firebase not configured! Missing environment variables:",
    missingVars.join(", "),
    "\n[firebase] To fix: copy .env.example to .env.local and fill in your Firebase credentials."
  );
  console.error(
    "[firebase] Get your credentials from: https://console.firebase.google.com/project/_/settings/general"
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Export auth only if fully configured; null otherwise
export const auth = isFirebaseConfigured ? getAuth(app) : null;