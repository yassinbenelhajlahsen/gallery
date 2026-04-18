// src/services/mediaTypes.ts
import type { ImageMeta } from "../services/storageService";

export type MediaType = "image" | "video";

export type BaseMediaMeta = {
  id: string;
  type: MediaType;
  date: string;
  event?: string;
};

export type VideoMeta = BaseMediaMeta & {
  type: "video";
  /** Storage path like videos/full/<id>.mp4 | .mov */
  videoPath: string;
  /** Thumbnail download URL (videos/thumb/<id>.jpg) */
  thumbUrl: string;
  /** Video duration in whole seconds */
  durationSeconds?: number;
  location?: { lat: number; lng: number };
};

export type ImageMediaMeta = ImageMeta & { type: "image" };

export type MediaMeta = ImageMediaMeta | VideoMeta;

export const isVideoMeta = (item: MediaMeta | undefined): item is VideoMeta =>
  Boolean(item && (item as VideoMeta).type === "video");

export const isImageMeta = (item: MediaMeta | undefined): item is ImageMediaMeta =>
  Boolean(item && !isVideoMeta(item));
