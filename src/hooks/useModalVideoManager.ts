import { useState, useEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import type { MediaMeta } from "../types/mediaTypes";
import { isVideoMeta } from "../types/mediaTypes";
import { getVideoDownloadUrl } from "../services/storageService";

export function useModalVideoManager(
  isOpen: boolean,
  currentItem: MediaMeta | undefined,
  videoElRef: RefObject<HTMLVideoElement | null>,
) {
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const videoLoadTokenRef = useRef(0);

  const cleanupVideo = useCallback(() => {
    const el = videoElRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        // ignore
      }
    }
    setActiveVideoUrl(null);
  }, [videoElRef]);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cleanupVideo();
      return;
    }

    if (!isVideoMeta(currentItem)) {
      cleanupVideo();
      return;
    }

    cleanupVideo();

    const token = ++videoLoadTokenRef.current;
    let cancelled = false;

    const run = async () => {
      try {
        const url = await getVideoDownloadUrl(currentItem.videoPath);
        if (cancelled || token !== videoLoadTokenRef.current) return;
        setActiveVideoUrl(url);
      } catch (err) {
        console.warn("[Modal] Failed to load video", err);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [cleanupVideo, currentItem, isOpen]);

  return { activeVideoUrl };
}
