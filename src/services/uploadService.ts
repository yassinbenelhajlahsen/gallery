import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, getMetadata, ref, uploadBytes } from "firebase/storage";
import { db } from "./firebaseFirestore";
import { storage } from "./firebaseStorage";
import { getVideoExtension } from "../utils/uploadMediaUtils";

function normalizeDurationSeconds(rawDuration: number): number | null {
  if (!Number.isFinite(rawDuration) || rawDuration < 0) return null;
  return Math.round(rawDuration);
}

export async function extractVideoPoster(
  file: File,
  maxEdge = 480,
): Promise<{ posterBlob: Blob; durationSeconds: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    let durationSeconds: number | null = null;

    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
      URL.revokeObjectURL(objectUrl);
    };

    const safeReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const safeResolve = (value: { posterBlob: Blob; durationSeconds: number }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    video.onloadedmetadata = async () => {
      try {
        const normalized = normalizeDurationSeconds(video.duration);
        if (normalized === null) {
          safeReject(new Error(`Failed to read video duration: ${file.name}`));
          return;
        }
        durationSeconds = normalized;

        const target = Math.min(0.1, Math.max(0, video.duration || 0));
        const seekTo = Number.isFinite(target) ? target : 0;
        video.currentTime = seekTo;
      } catch {
        try {
          video.currentTime = 0;
        } catch (err) {
          safeReject(err);
        }
      }
    };

    video.onseeked = () => {
      try {
        const normalized = normalizeDurationSeconds(video.duration);
        const resolvedDuration = durationSeconds ?? normalized;
        if (resolvedDuration === null) {
          safeReject(new Error(`Failed to read video duration: ${file.name}`));
          return;
        }

        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error("Unable to read video dimensions");

        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const outW = Math.round(w * scale);
        const outH = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context is null");
        ctx.drawImage(video, 0, 0, outW, outH);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              safeReject(new Error("Poster JPEG conversion failed"));
              return;
            }
            safeResolve({ posterBlob: blob, durationSeconds: resolvedDuration });
          },
          "image/jpeg",
          0.7,
        );
      } catch (err) {
        safeReject(err);
      }
    };

    video.onerror = () => {
      safeReject(new Error(`Failed to load video: ${file.name}`));
    };

    video.src = objectUrl;
  });
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          `Failed to load image: ${file.name} (Type: ${file.type}, Size: ${file.size} bytes)`,
        ),
      );
    };
    img.onabort = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Image load aborted: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

function canvasToJpeg(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas context is null"));

    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("JPEG conversion failed"));
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function convertToJpeg(img: HTMLImageElement): Promise<Blob> {
  return canvasToJpeg(img, img.width, img.height, 0.9);
}

export async function generateThumbnail(
  img: HTMLImageElement,
  maxEdge = 480,
): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const thumbW = Math.round(img.width * scale);
  const thumbH = Math.round(img.height * scale);
  return canvasToJpeg(img, thumbW, thumbH, 0.7);
}

function firebaseErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

async function storageObjectExists(path: string): Promise<boolean> {
  try {
    await getMetadata(ref(storage, path));
    return true;
  } catch (error) {
    if (firebaseErrorCode(error) === "storage/object-not-found") {
      return false;
    }
    throw error;
  }
}

async function mediaCandidateExists(
  collectionName: "images" | "videos",
  id: string,
  fullPath: string,
  thumbPath: string,
): Promise<boolean> {
  const [docSnap, fullExists, thumbExists] = await Promise.all([
    getDoc(doc(db, collectionName, id)),
    storageObjectExists(fullPath),
    storageObjectExists(thumbPath),
  ]);
  return docSnap.exists() || fullExists || thumbExists;
}

export async function resolveUniqueImageName(cleanName: string): Promise<string> {
  const baseName = cleanName.trim() || "upload";
  let suffix = 0;
  while (true) {
    const jpgName = suffix === 0 ? `${baseName}.jpg` : `${baseName}-${suffix}.jpg`;
    const exists = await mediaCandidateExists(
      "images",
      jpgName,
      `images/full/${jpgName}`,
      `images/thumb/${jpgName}`,
    );
    if (!exists) return jpgName;
    suffix += 1;
  }
}

export async function resolveUniqueVideoNames(
  cleanName: string,
  ext: string,
): Promise<{ videoId: string; thumbName: string }> {
  const baseName = cleanName.trim() || "upload";
  let suffix = 0;
  while (true) {
    const candidateBase = suffix === 0 ? baseName : `${baseName}-${suffix}`;
    const videoId = `${candidateBase}.${ext}`;
    const thumbName = `${candidateBase}.jpg`;
    const exists = await mediaCandidateExists(
      "videos",
      videoId,
      `videos/full/${videoId}`,
      `videos/thumb/${thumbName}`,
    );
    if (!exists) return { videoId, thumbName };
    suffix += 1;
  }
}

export async function createTimelineEvent(
  date: string,
  title: string,
  emojiOrDot?: string,
) {
  const eventData: Record<string, unknown> = {
    date,
    title: title.trim(),
    imageIds: [],
    createdAt: serverTimestamp(),
  };
  const trimmedEmoji = (emojiOrDot ?? "").trim();
  if (trimmedEmoji.length > 0) {
    eventData.emojiOrDot = trimmedEmoji;
  }

  await addDoc(collection(db, "events"), eventData);
}

export async function uploadVideoWithMetadata(
  file: File,
  date: string,
  eventName: string,
) {
  const cleanName = file.name.replace(/\.[^.]+$/, "");
  const ext = getVideoExtension(file);
  if (!ext) {
    throw new Error("Unsupported video format (only .mp4 and .mov)");
  }

  const { posterBlob, durationSeconds } = await extractVideoPoster(file);
  const { videoId, thumbName } = await resolveUniqueVideoNames(cleanName, ext);

  const fullRef = ref(storage, `videos/full/${videoId}`);
  const thumbRef = ref(storage, `videos/thumb/${thumbName}`);

  await Promise.all([
    uploadBytes(fullRef, file, { contentType: file.type }),
    uploadBytes(thumbRef, posterBlob, { contentType: "image/jpeg" }),
  ]);

  const payload: Record<string, unknown> = {
    id: videoId,
    type: "video",
    date,
    videoPath: `videos/full/${videoId}`,
    thumbPath: `videos/thumb/${thumbName}`,
    durationSeconds,
    createdAt: serverTimestamp(),
  };
  if (eventName.trim().length > 0) payload.event = eventName.trim();

  await setDoc(doc(db, "videos", videoId), payload, { merge: true });
  const url = await getDownloadURL(thumbRef).catch(() => "");

  return { videoId, url };
}

export async function uploadImageWithMetadata(
  file: File,
  date: string,
  eventName: string,
) {
  const cleanName = file.name.replace(/\.[^.]+$/, "");
  const img = await loadImage(file);
  const [jpegBlob, thumbBlob] = await Promise.all([
    convertToJpeg(img),
    generateThumbnail(img),
  ]);

  const jpgName = await resolveUniqueImageName(cleanName);
  const fullRef = ref(storage, `images/full/${jpgName}`);
  const thumbRef = ref(storage, `images/thumb/${jpgName}`);

  await Promise.all([
    uploadBytes(fullRef, jpegBlob, { contentType: "image/jpeg" }),
    uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" }),
  ]);

  const payload: Record<string, unknown> = {
    id: jpgName,
    type: "image",
    date,
    fullPath: `images/full/${jpgName}`,
    thumbPath: `images/thumb/${jpgName}`,
    createdAt: serverTimestamp(),
  };
  if (eventName.trim().length > 0) payload.event = eventName.trim();

  await setDoc(doc(db, "images", jpgName), payload, { merge: true });
  const url = await getDownloadURL(fullRef).catch(() => "");

  return { jpgName, url };
}
