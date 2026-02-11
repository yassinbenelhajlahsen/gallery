// src/services/eventsService.ts
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "./firebaseFirestore";
import type { TimelineEvent } from "../components/TimelineEventItem";

const isPermissionDenied = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "permission-denied";

/**
 * Firestore-backed events service.
 * Exposes a simple fetchEvents() helper that returns TimelineEvent[]
 * Documents are read from the `events` collection and ordered by `date` desc.
 * Document ID is taken as `id` (so Firestore docId must equal event.id).
 */
export async function fetchEvents(): Promise<TimelineEvent[]> {
  try {
    const q = query(collection(db, "events"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    const events: TimelineEvent[] = snap.docs.map((doc) => {
      const data = doc.data() as Partial<TimelineEvent>;
      // Ensure the returned object has shape { id, date, title, emojiOrDot?, imageIds? }
      return {
        id: doc.id,
        date: data.date ?? "",
        title: data.title ?? "",
        emojiOrDot: data.emojiOrDot,
        imageIds: data.imageIds ?? [],
      } as TimelineEvent;
    });
    return events;
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        "Firestore rules denied events access. Ensure owner-only rules allow /events for your owner UID.",
      );
    }
    throw error;
  }
}

export default { fetchEvents };
