// src/services/authService.ts
import type { Unsubscribe, User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
import { config } from "../config";

const LOGIN_EMAIL = config.authEmail;

async function signInWithPassword(password: string) {
  if (!password) {
    throw new Error("Password is required");
  }

  return signInWithEmailAndPassword(auth, LOGIN_EMAIL, password);
}

function subscribeToAuthChanges(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export const authService = {
  LOGIN_EMAIL,
  signInWithPassword,
  signOut: async () => signOut(auth),
  subscribeToAuthChanges,
};
