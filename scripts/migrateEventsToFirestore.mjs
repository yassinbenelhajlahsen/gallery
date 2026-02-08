// scripts/migrateEventsToFirestore.mjs
import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  "serviceAccountKey.json"
);

const EVENTS_JSON_PATH = path.join(
  __dirname,
  "../src/assets/events.json"
);

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrate() {
  const raw = fs.readFileSync(EVENTS_JSON_PATH, "utf8");
  const events = JSON.parse(raw);

  if (!Array.isArray(events)) {
    throw new Error("events.json must be an array");
  }

  const batch = db.batch();

  for (const event of events) {
    if (!event.id) {
      throw new Error("Event missing id");
    }

    const ref = db.collection("events").doc(event.id);
    batch.set(ref, event, { merge: true });
  }

  await batch.commit();
  console.log(`✅ Migrated ${events.length} events to Firestore`);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
