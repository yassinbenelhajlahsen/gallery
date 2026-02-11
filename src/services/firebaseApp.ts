import { getApp, getApps, initializeApp } from "firebase/app";

const readRequiredEnv = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `[Firebase] Missing required environment variable: ${name}`,
    );
  }
  return value;
};

export const firebaseConfig = {
  apiKey: readRequiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readRequiredEnv("VITE_FIREBASE_APP_ID"),
};

export const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
