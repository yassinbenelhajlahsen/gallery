// src/services/storageService.ts
import type { FullMetadata } from "firebase/storage";
import {
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
} from "firebase/storage";
import { app } from "./firebaseConfig";
import type { VideoMeta } from "./mediaTypes";

const storage = getStorage(app);

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

const normalizeDate = (metadata: FullMetadata): string => {
  const customDate =
    metadata.customMetadata?.date ?? metadata.customMetadata?.Date;
  const fallback =
    customDate ??
    metadata.updated ??
    metadata.timeCreated ??
    new Date().toISOString();
  const timestamp = Date.parse(fallback);
  if (Number.isNaN(timestamp)) {
    return new Date().toISOString();
  }
  return new Date(timestamp).toISOString();
};

const extractEvent = (metadata: FullMetadata) =>
  metadata.customMetadata?.event ?? metadata.customMetadata?.Event ?? undefined;

const extractCaption = (metadata: FullMetadata) =>
  metadata.customMetadata?.caption ??
  metadata.customMetadata?.Caption ??
  undefined;

export async function fetchAllImageMetadata(): Promise<ImageMeta[]> {
  const fullResult = await listAll(ref(storage, FULL_ROOT));

  const imagePromises = fullResult.items.map(async (itemRef) => {
    const thumbRef = ref(storage, `${THUMB_ROOT}/${itemRef.name}`);

    const [metadata, downloadUrl, thumbUrl] = await Promise.all([
      getMetadata(itemRef),
      getDownloadURL(itemRef),
      getDownloadURL(thumbRef).catch(() => null),
    ]);

    const date = normalizeDate(metadata);
    const event = extractEvent(metadata);

    return {
      id: itemRef.name,
      storagePath: itemRef.fullPath,
      date,
      event,
      caption: extractCaption(metadata),
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
  const fullResult = await listAll(ref(storage, VIDEO_FULL_ROOT));

  const videoPromises = fullResult.items
    .filter((itemRef) => hasAllowedVideoExtension(itemRef.name))
    .map(async (itemRef) => {
      const thumbName = itemRef.name.replace(/\.[^.]+$/, ".jpg");
      const thumbRef = ref(storage, `${VIDEO_THUMB_ROOT}/${thumbName}`);

      const [metadata, thumbUrl] = await Promise.all([
        getMetadata(itemRef),
        // Thumb URL is allowed (JPEG only)
        getDownloadURL(thumbRef),
      ]);

      const date = normalizeDate(metadata);
      const event = extractEvent(metadata);

      return {
        id: itemRef.name,
        type: "video",
        date,
        event,
        caption: extractCaption(metadata),
        videoPath: itemRef.fullPath,
        thumbUrl,
      } satisfies VideoMeta;
    });

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
