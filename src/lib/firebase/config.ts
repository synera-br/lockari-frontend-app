
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Crucial check for Firebase configuration
const requiredEnvVars: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingConfig = requiredEnvVars.filter(key => !firebaseConfig[key]);

if (missingConfig.length > 0) {
    const missingKeys = missingConfig.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    throw new Error(
    `Firebase configuration is missing. Please add the following environment variables to your .env.local file: ${missingKeys.join(', ')}\n` +
    `To fix this, create a file named ".env.local" in your project root, copy the contents from ".env.local.example", and fill in your actual Firebase credentials.`
  );
}

// Additional check for placeholder values to improve developer experience
if (firebaseConfig.apiKey?.includes('YOUR_')) {
  throw new Error(
    'Your Firebase API Key seems to be a placeholder. Please check your .env.local file and replace the placeholder value with your actual Firebase API Key.'
  );
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Backend URL
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;


export { app, auth, db };
