import { deleteObject, ref } from "firebase/storage";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebaseFirestore";
import { storage } from "./firebaseStorage";

const isStorageObjectMissing = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  return code === "storage/object-not-found";
};

const parseLocalDateLike = (dateValue: string): Date | null => {
  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yearRaw, monthRaw, dayRaw] = isoMatch;
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split("/").map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

export const toDateLabel = (dateValue: string) => {
  const parsed = parseLocalDateLike(dateValue);
  if (!parsed) return dateValue;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const toDateSearchTokens = (dateValue: string): string[] => {
  const trimmed = dateValue.trim();
  if (!trimmed) return [];

  const tokens = new Set<string>([trimmed.toLowerCase()]);

  const parsed = parseLocalDateLike(trimmed);
  if (parsed) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    tokens.add(`${year}-${mm}-${dd}`);
    tokens.add(`${mm}/${dd}/${year}`);
    tokens.add(`${month}/${day}/${year}`);
  }

  tokens.add(toDateLabel(trimmed).toLowerCase());
  return Array.from(tokens);
};

export const buildSearchIndex = (...parts: Array<string | undefined>): string =>
  parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase())
    .join(" ");

export const matchesTokens = (index: string, tokens: string[]) =>
  tokens.every((token) => index.includes(token));

export const normalizeImageSrc = (
  src: string | null | undefined,
): string | null => {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const toDateInputValue = (dateValue: string): string => {
  const parsed = parseLocalDateLike(dateValue);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const removeMediaFromEventRefs = async (mediaId: string) => {
  const eventsWithMedia = await getDocs(
    query(collection(db, "events"), where("imageIds", "array-contains", mediaId)),
  );

  await Promise.all(
    eventsWithMedia.docs.map(async (eventDoc) => {
      await updateDoc(eventDoc.ref, {
        imageIds: arrayRemove(mediaId),
      });
    }),
  );
};

export const updateEventFieldOnLinkedMedia = async (
  eventTitle: string,
  mediaIds: string[],
  nextEventValue: string | null,
) => {
  const batch = writeBatch(db);
  const queuedRefs = new Set<string>();

  const queueUpdateEvent = (collectionName: "images" | "videos", id: string) => {
    const key = `${collectionName}:${id}`;
    if (queuedRefs.has(key)) return;
    queuedRefs.add(key);
    batch.update(doc(db, collectionName, id), { event: nextEventValue });
  };

  const [imagesByEvent, videosByEvent] = await Promise.all([
    getDocs(query(collection(db, "images"), where("event", "==", eventTitle))),
    getDocs(query(collection(db, "videos"), where("event", "==", eventTitle))),
  ]);

  imagesByEvent.docs.forEach((imageDoc) => queueUpdateEvent("images", imageDoc.id));
  videosByEvent.docs.forEach((videoDoc) => queueUpdateEvent("videos", videoDoc.id));

  await Promise.all(
    mediaIds.map(async (mediaId) => {
      const [imageDoc, videoDoc] = await Promise.all([
        getDoc(doc(db, "images", mediaId)),
        getDoc(doc(db, "videos", mediaId)),
      ]);
      if (imageDoc.exists()) queueUpdateEvent("images", mediaId);
      if (videoDoc.exists()) queueUpdateEvent("videos", mediaId);
    }),
  );

  if (queuedRefs.size > 0) {
    await batch.commit();
  }
};

export const deleteImageWithMetadata = async (
  id: string,
  fullPath: string,
  thumbPath: string,
) => {
  const [fullResult, thumbResult] = await Promise.allSettled([
    deleteObject(ref(storage, fullPath)),
    deleteObject(ref(storage, thumbPath)),
  ]);

  const fullError = fullResult.status === "rejected" ? fullResult.reason : null;
  const thumbError =
    thumbResult.status === "rejected" ? thumbResult.reason : null;

  if (fullError && !isStorageObjectMissing(fullError)) throw fullError;
  if (thumbError && !isStorageObjectMissing(thumbError)) throw thumbError;

  await deleteDoc(doc(db, "images", id));
  await removeMediaFromEventRefs(id);
};

export const deleteVideoWithMetadata = async (
  id: string,
  fullPath: string,
  thumbPath: string,
) => {
  const [fullResult, thumbResult] = await Promise.allSettled([
    deleteObject(ref(storage, fullPath)),
    deleteObject(ref(storage, thumbPath)),
  ]);

  const fullError = fullResult.status === "rejected" ? fullResult.reason : null;
  const thumbError =
    thumbResult.status === "rejected" ? thumbResult.reason : null;

  if (fullError && !isStorageObjectMissing(fullError)) throw fullError;
  if (thumbError && !isStorageObjectMissing(thumbError)) throw thumbError;

  await deleteDoc(doc(db, "videos", id));
  await removeMediaFromEventRefs(id);
};

export const deleteEventWithLinkedMediaCleanup = async (
  eventId: string,
  eventTitle: string,
  mediaIds: string[],
) => {
  await updateEventFieldOnLinkedMedia(eventTitle, mediaIds, null);
  await deleteDoc(doc(db, "events", eventId));
};

export const updateMediaMetadata = async (
  mediaKind: "image" | "video",
  id: string,
  date: string,
  event: string,
) => {
  const collectionName = mediaKind === "image" ? "images" : "videos";
  const eventValue = event.trim();
  await updateDoc(doc(db, collectionName, id), {
    date,
    event: eventValue.length > 0 ? eventValue : null,
  });
};

export const updateTimelineEventMetadata = async ({
  id,
  date,
  title,
  emojiOrDot,
  originalTitle,
  mediaIds,
}: {
  id: string;
  date: string;
  title: string;
  emojiOrDot?: string;
  originalTitle: string;
  mediaIds: string[];
}) => {
  const trimmedTitle = title.trim();
  const trimmedEmoji = (emojiOrDot ?? "").trim();

  await updateDoc(doc(db, "events", id), {
    date,
    title: trimmedTitle,
    emojiOrDot: trimmedEmoji.length > 0 ? trimmedEmoji : null,
  });

  if (originalTitle !== trimmedTitle) {
    await updateEventFieldOnLinkedMedia(originalTitle, mediaIds, trimmedTitle);
  }
};
