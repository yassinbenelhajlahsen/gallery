import type { FullMetadata } from "firebase/storage";
import {
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
} from "firebase/storage";
import { app } from "./firebaseConfig";

const storage = getStorage(app);

/**
 * Storage layout:
 *   images/full/<id>.jpg   — original / full-resolution
 *   images/thumb/<id>.jpg  — 480px thumbnail
 */
const FULL_ROOT = "images/full";
const THUMB_ROOT = "images/thumb";

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

export const storageService = {
  fetchAllImageMetadata,
};
