import { useCallback, useEffect, useRef, useState } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import {
  deleteEventWithLinkedMediaCleanup,
  deleteImageWithMetadata,
  deleteVideoWithMetadata,
} from "../services/deleteService";

const ARMED_TIMEOUT_MS = 3000;

export function useDeleteConfirmation(isSavingEdit: boolean) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const armedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    events,
    removeImageMeta,
    removeVideoMeta,
    removeEvent,
    patchEvent,
    patchImageMeta,
    patchVideoMeta,
  } = useGallery();
  const { toast } = useToast();

  const clearArmedTimer = useCallback(() => {
    if (armedTimerRef.current) {
      clearTimeout(armedTimerRef.current);
      armedTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearArmedTimer, [clearArmedTimer]);

  const armKey = useCallback(
    (key: string) => {
      setArmedKey(key);
      clearArmedTimer();
      armedTimerRef.current = setTimeout(() => {
        setArmedKey((current) => (current === key ? null : current));
        armedTimerRef.current = null;
      }, ARMED_TIMEOUT_MS);
    },
    [clearArmedTimer],
  );

  const stripMediaFromEvents = useCallback(
    (mediaId: string) => {
      for (const ev of events) {
        if (ev.imageIds?.includes(mediaId)) {
          patchEvent(ev.id, {
            imageIds: ev.imageIds.filter((x) => x !== mediaId),
          });
        }
      }
    },
    [events, patchEvent],
  );

  const runDelete = useCallback(
    async (
      key: string,
      kind: "image" | "video" | "event",
      onConfirm: () => Promise<void>,
    ) => {
      setBusyKey(key);
      clearArmedTimer();
      setArmedKey(null);
      try {
        await onConfirm();
      } catch (error) {
        if (kind === "event") {
          console.error("Failed to delete event", error);
          toast("Failed to delete timeline event.", "error");
        } else {
          console.error(`Failed to delete ${kind}`, error);
          toast(`Failed to delete ${kind}. Check console for details.`, "error");
        }
      } finally {
        setBusyKey(null);
      }
    },
    [clearArmedTimer, toast],
  );

  const handlePress = useCallback(
    (
      key: string,
      kind: "image" | "video" | "event",
      onConfirm: () => Promise<void>,
    ) => {
      if (busyKey || isSavingEdit) return;
      if (armedKey === key) {
        void runDelete(key, kind, onConfirm);
        return;
      }
      armKey(key);
    },
    [armKey, armedKey, busyKey, isSavingEdit, runDelete],
  );

  const requestDeleteImage = useCallback(
    (id: string, fullPath: string, thumbPath: string) => {
      handlePress(`image:${id}`, "image", async () => {
        await deleteImageWithMetadata(id, fullPath, thumbPath);
        removeImageMeta(id);
        stripMediaFromEvents(id);
        toast(`Deleted image ${id}`, "success");
      });
    },
    [handlePress, removeImageMeta, stripMediaFromEvents, toast],
  );

  const requestDeleteVideo = useCallback(
    (id: string, fullPath: string, thumbPath: string) => {
      handlePress(`video:${id}`, "video", async () => {
        await deleteVideoWithMetadata(id, fullPath, thumbPath);
        removeVideoMeta(id);
        stripMediaFromEvents(id);
        toast(`Deleted video ${id}`, "success");
      });
    },
    [handlePress, removeVideoMeta, stripMediaFromEvents, toast],
  );

  const requestDeleteEvent = useCallback(
    (eventId: string, eventTitle: string, mediaIds: string[]) => {
      handlePress(`event:${eventId}`, "event", async () => {
        await deleteEventWithLinkedMediaCleanup(eventId, eventTitle);
        removeEvent(eventId);
        for (const mediaId of mediaIds) {
          patchImageMeta(mediaId, { event: undefined });
          patchVideoMeta(mediaId, { event: undefined });
        }
        toast("Deleted timeline event", "success");
      });
    },
    [handlePress, patchImageMeta, patchVideoMeta, removeEvent, toast],
  );

  const buttonLabel = useCallback(
    (key: string) => {
      if (busyKey === key) return "Deleting...";
      if (armedKey === key) return "Confirm?";
      return "Delete";
    },
    [armedKey, busyKey],
  );

  return {
    busyKey,
    armedKey,
    requestDeleteImage,
    requestDeleteVideo,
    requestDeleteEvent,
    buttonLabel,
  };
}
