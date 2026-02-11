// src/services/storageService.ts
import { getDownloadURL, ref } from "firebase/storage";
import { getDocs, collection } from "firebase/firestore";
import { storage, db } from "./firebaseConfig";
import type { VideoMeta } from "../types/mediaTypes";

/**
 * Storage layout:
 *   images/full/<id>.jpg   — original / full-resolution
 *   images/thumb/<id>.jpg  — 480px thumbnail
 */
const FULL_ROOT = "images/full";
const THUMB_ROOT = "images/thumb";

/**
 * Video storage layout:
 *   videos/full/<id>.mp4 | .mov  — original
 *   videos/thumb/<id>.jpg        — thumbnail / poster
 */
const VIDEO_FULL_ROOT = "videos/full";
const VIDEO_THUMB_ROOT = "videos/thumb";

export type ImageMeta = {
  id: string;
  storagePath: string;
  date: string;
  event?: string;
  caption?: string;
  /** Full-resolution download URL */
  downloadUrl: string;
  /** Thumbnail download URL */
  thumbUrl: string;
};

export type PreloadedImage = {
  meta: ImageMeta;
  blob: Blob;
  objectUrl: string;
};

type FirestoreTimestampLike = {
  toDate: () => Date;
};

const isFirestoreTimestampLike = (
  value: unknown,
): value is FirestoreTimestampLike => {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
};

const normalizeDateField = (raw: unknown): string => {
  if (!raw) return new Date().toISOString();
  try {
    // Firestore Timestamp support
    if (isFirestoreTimestampLike(raw)) {
      return raw.toDate().toISOString();
    }
    if (typeof raw === "string") {
      const ts = Date.parse(raw);
      if (!Number.isNaN(ts)) return new Date(ts).toISOString();
    }
  } catch {
    // fallthrough
  }
  return new Date().toISOString();
};

export async function fetchAllImageMetadata(): Promise<ImageMeta[]> {
  const snap = await getDocs(collection(db, "images"));

  const imagePromises = snap.docs.map(async (d) => {
    const data = d.data() as Record<string, unknown>;
    const id = (data.id as string) ?? d.id;
    const storagePath = (data.fullPath as string) ?? `${FULL_ROOT}/${id}`;
    const thumbPath = (data.thumbPath as string) ?? `${THUMB_ROOT}/${id}`;

    // Build download URLs
    const downloadUrl = await getDownloadURL(ref(storage, storagePath));
    const thumbUrl = await getDownloadURL(ref(storage, thumbPath)).catch(
      () => null,
    );

    const date = normalizeDateField(data.date);

    return {
      id,
      storagePath,
      date,
      event: typeof data.event === "string" ? data.event : undefined,
      caption: typeof data.caption === "string" ? data.caption : undefined,
      downloadUrl,
      thumbUrl: thumbUrl ?? downloadUrl,
    } satisfies ImageMeta;
  });

  const unsorted = await Promise.all(imagePromises);
  return unsorted.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

const hasAllowedVideoExtension = (name: string) =>
  name.toLowerCase().endsWith(".mp4") || name.toLowerCase().endsWith(".mov");

/**
 * Fetch ALL video metadata WITHOUT downloading any video bytes.
 *
 * Rules:
 * - Must NOT call getDownloadURL() for the video.
 * - Can resolve thumb URLs (JPEG only) for display.
 */
export async function fetchAllVideoMetadata(): Promise<VideoMeta[]> {
  const snap = await getDocs(collection(db, "videos"));

  const videoPromises = snap.docs
    .map(async (d) => {
      const data = d.data() as Record<string, unknown>;
      const id = (data.id as string) ?? d.id;

      if (!hasAllowedVideoExtension(id)) return null;

      const videoPath =
        (data.videoPath as string) ?? `${VIDEO_FULL_ROOT}/${id}`;
      const thumbPath =
        (data.thumbPath as string) ??
        `${VIDEO_THUMB_ROOT}/${id.replace(/\.[^.]+$/, ".jpg")}`;

      // Resolve thumb URL; if missing, fallback to the video's download URL
      const thumbUrl = await getDownloadURL(ref(storage, thumbPath)).catch(
        async () =>
          await getDownloadURL(ref(storage, videoPath)).catch(() => ""),
      );

      const date = normalizeDateField(data.date);

      return {
        id,
        type: "video",
        date,
        event: typeof data.event === "string" ? data.event : undefined,
        caption: typeof data.caption === "string" ? data.caption : undefined,
        videoPath,
        thumbUrl,
      } satisfies VideoMeta;
    })
    .filter(Boolean) as Promise<VideoMeta>[];

  const unsorted = await Promise.all(videoPromises);
  return unsorted.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/**
 * Get a download URL for a video file. Call this ONLY after a user clicks a video tile.
 */
export async function getVideoDownloadUrl(videoPath: string): Promise<string> {
  const videoRef = ref(storage, videoPath);
  return getDownloadURL(videoRef);
}

export const storageService = {
  fetchAllImageMetadata,
  fetchAllVideoMetadata,
  getVideoDownloadUrl,
};
