// src/services/firebaseConfig.ts
// Backward-compatible barrel for legacy imports.
// Prefer importing from firebaseApp/firebaseAuth/firebaseFirestore/firebaseStorage directly.
export { app, firebaseConfig } from "./firebaseApp";
export { auth } from "./firebaseAuth";
export { db } from "./firebaseFirestore";
export { storage } from "./firebaseStorage";
