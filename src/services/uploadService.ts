import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  ref,
  uploadBytesResumable,
  type StorageReference,
  type UploadMetadata,
} from "firebase/storage";
import exifr from "exifr";
import { db } from "./firebaseFirestore";
import { storage } from "./firebaseStorage";
import { getVideoExtension } from "../utils/uploadMediaUtils";

export type GpsLocation = { lat: number; lng: number };

/** Reports upload progress as a fraction in [0, 1] covering the byte-transfer phase only. */
export type UploadProgressCallback = (fraction: number) => void;

export type StagedImage = {
  jpgName: string;
  fullPath: string;
  thumbPath: string;
  location: GpsLocation | null;
};

export type StagedVideo = {
  videoId: string;
  thumbName: string;
  videoPath: string;
  thumbPath: string;
  durationSeconds: number;
};

function uploadBlobWithProgress(
  storageRef: StorageReference,
  data: Blob | File,
  metadata: UploadMetadata,
  onSnapshot: (transferred: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }
    const task = uploadBytesResumable(storageRef, data, metadata);
    const onAbort = () => {
      task.cancel();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    task.on(
      "state_changed",
      (snapshot) => onSnapshot(snapshot.bytesTransferred, snapshot.totalBytes),
      (error) => {
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      },
      () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }
}

async function readGpsLocation(file: File): Promise<GpsLocation | null> {
  try {
    const gps = await exifr.gps(file);
    if (!gps) return null;
    const { latitude, longitude } = gps;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { lat: latitude, lng: longitude };
  } catch {
    return null;
  }
}

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

/**
 * Stage 1 of the two-phase upload: convert + resolve unique name + push bytes
 * to Storage. The Firestore "publication" doc is NOT written here — call
 * `commitImage` once the user confirms the upload, or `discardStagedImage` if
 * the user removes the file from the draft.
 */
export async function stageImage(
  file: File,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal,
): Promise<StagedImage> {
  const cleanName = file.name.replace(/\.[^.]+$/, "");
  const [img, location] = await Promise.all([
    loadImage(file),
    readGpsLocation(file),
  ]);
  throwIfAborted(signal);
  const [jpegBlob, thumbBlob] = await Promise.all([
    convertToJpeg(img),
    generateThumbnail(img),
  ]);
  throwIfAborted(signal);

  const jpgName = await resolveUniqueImageName(cleanName);
  throwIfAborted(signal);

  const fullPath = `images/full/${jpgName}`;
  const thumbPath = `images/thumb/${jpgName}`;
  const fullRef = ref(storage, fullPath);
  const thumbRef = ref(storage, thumbPath);

  let fullXfer = 0;
  let fullTotal = jpegBlob.size;
  let thumbXfer = 0;
  let thumbTotal = thumbBlob.size;
  const report = () => {
    const total = fullTotal + thumbTotal;
    if (total <= 0) return;
    onProgress?.(Math.min(1, (fullXfer + thumbXfer) / total));
  };

  await Promise.all([
    uploadBlobWithProgress(
      fullRef,
      jpegBlob,
      { contentType: "image/jpeg" },
      (x, t) => {
        fullXfer = x;
        fullTotal = t;
        report();
      },
      signal,
    ),
    uploadBlobWithProgress(
      thumbRef,
      thumbBlob,
      { contentType: "image/jpeg" },
      (x, t) => {
        thumbXfer = x;
        thumbTotal = t;
        report();
      },
      signal,
    ),
  ]);
  onProgress?.(1);

  return { jpgName, fullPath, thumbPath, location };
}

/**
 * Stage 2: write the Firestore image doc that "publishes" a staged image into
 * the gallery. Cheap (single write) — runs when the user clicks Upload.
 */
export async function commitImage(
  staged: StagedImage,
  date: string,
  eventName: string,
): Promise<{ jpgName: string; url: string }> {
  const payload: Record<string, unknown> = {
    id: staged.jpgName,
    type: "image",
    date,
    fullPath: staged.fullPath,
    thumbPath: staged.thumbPath,
    createdAt: serverTimestamp(),
  };
  if (eventName.trim().length > 0) payload.event = eventName.trim();
  if (staged.location) payload.location = staged.location;

  await setDoc(doc(db, "images", staged.jpgName), payload, { merge: true });
  const url = await getDownloadURL(ref(storage, staged.fullPath)).catch(() => "");
  return { jpgName: staged.jpgName, url };
}

/** Best-effort: delete staged Storage blobs when the user removes a file before committing. */
export async function discardStagedImage(
  staged: Pick<StagedImage, "fullPath" | "thumbPath">,
): Promise<void> {
  await Promise.all([
    deleteObject(ref(storage, staged.fullPath)).catch(() => {}),
    deleteObject(ref(storage, staged.thumbPath)).catch(() => {}),
  ]);
}

export async function stageVideo(
  file: File,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal,
): Promise<StagedVideo> {
  const cleanName = file.name.replace(/\.[^.]+$/, "");
  const ext = getVideoExtension(file);
  if (!ext) {
    throw new Error("Unsupported video format (only .mp4 and .mov)");
  }

  const { posterBlob, durationSeconds } = await extractVideoPoster(file);
  throwIfAborted(signal);
  const { videoId, thumbName } = await resolveUniqueVideoNames(cleanName, ext);
  throwIfAborted(signal);

  const videoPath = `videos/full/${videoId}`;
  const thumbPath = `videos/thumb/${thumbName}`;
  const fullRef = ref(storage, videoPath);
  const thumbRef = ref(storage, thumbPath);

  let fullXfer = 0;
  let fullTotal = file.size;
  let thumbXfer = 0;
  let thumbTotal = posterBlob.size;
  const report = () => {
    const total = fullTotal + thumbTotal;
    if (total <= 0) return;
    onProgress?.(Math.min(1, (fullXfer + thumbXfer) / total));
  };

  await Promise.all([
    uploadBlobWithProgress(
      fullRef,
      file,
      { contentType: file.type },
      (x, t) => {
        fullXfer = x;
        fullTotal = t;
        report();
      },
      signal,
    ),
    uploadBlobWithProgress(
      thumbRef,
      posterBlob,
      { contentType: "image/jpeg" },
      (x, t) => {
        thumbXfer = x;
        thumbTotal = t;
        report();
      },
      signal,
    ),
  ]);
  onProgress?.(1);

  return { videoId, thumbName, videoPath, thumbPath, durationSeconds };
}

export async function commitVideo(
  staged: StagedVideo,
  date: string,
  eventName: string,
): Promise<{ videoId: string; url: string }> {
  const payload: Record<string, unknown> = {
    id: staged.videoId,
    type: "video",
    date,
    videoPath: staged.videoPath,
    thumbPath: staged.thumbPath,
    durationSeconds: staged.durationSeconds,
    createdAt: serverTimestamp(),
  };
  if (eventName.trim().length > 0) payload.event = eventName.trim();

  await setDoc(doc(db, "videos", staged.videoId), payload, { merge: true });
  const url = await getDownloadURL(ref(storage, staged.thumbPath)).catch(() => "");
  return { videoId: staged.videoId, url };
}

export async function discardStagedVideo(
  staged: Pick<StagedVideo, "videoPath" | "thumbPath">,
): Promise<void> {
  await Promise.all([
    deleteObject(ref(storage, staged.videoPath)).catch(() => {}),
    deleteObject(ref(storage, staged.thumbPath)).catch(() => {}),
  ]);
}
