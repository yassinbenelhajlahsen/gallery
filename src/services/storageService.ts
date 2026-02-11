// src/services/storageService.ts
import { getDownloadURL, ref } from "firebase/storage";
import { getDocs, collection } from "firebase/firestore";
import { storage } from "./firebaseStorage";
import { db } from "./firebaseFirestore";
import type { VideoMeta } from "../types/mediaTypes";

const isPermissionDenied = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "permission-denied";

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
  try {
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
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        "Firestore rules denied images access. This app requires /images for the owner account.",
      );
    }
    throw error;
  }
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
  try {
    const snap = await getDocs(collection(db, "videos"));

    const videoPromises: Array<Promise<VideoMeta | null>> = snap.docs.map(async (d) => {
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
          type: "video" as const,
          date,
          event: typeof data.event === "string" ? data.event : undefined,
          caption: typeof data.caption === "string" ? data.caption : undefined,
          videoPath,
          thumbUrl,
        } satisfies VideoMeta;
      });

    const unsorted = await Promise.all(videoPromises);
    const videos = unsorted.filter((item): item is VideoMeta => item !== null);
    return videos.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        "Firestore rules denied videos access. This app requires /videos for the owner account.",
      );
    }
    throw error;
  }
}

/**
 * Get a download URL for a video file. Call this ONLY after a user clicks a video tile.
 */
export async function getVideoDownloadUrl(videoPath: string): Promise<string> {
  try {
    const videoRef = ref(storage, videoPath);
    return await getDownloadURL(videoRef);
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        "Storage rules denied video access. Ensure /videos is owner-readable.",
      );
    }
    throw error;
  }
}

export const storageService = {
  fetchAllImageMetadata,
  fetchAllVideoMetadata,
  getVideoDownloadUrl,
};
