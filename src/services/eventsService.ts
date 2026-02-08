// src/services/eventsService.ts
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "./firebaseConfig";
import type { TimelineEvent } from "../components/TimelineEventItem";

/**
 * Firestore-backed events service.
 * Exposes a simple fetchEvents() helper that returns TimelineEvent[]
 * Documents are read from the `events` collection and ordered by `date` desc.
 * Document ID is taken as `id` (so Firestore docId must equal event.id).
 */
export async function fetchEvents(): Promise<TimelineEvent[]> {
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
}

export default { fetchEvents };
