import { useState, useCallback } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import {
  toDateInputValue,
  updateMediaMetadata,
  updateTimelineEventMetadata,
} from "../services/deleteService";
import type { EditDraft } from "../components/ui/EditMetadataModal";

export function useMetadataEditor() {
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const { patchImageMeta, patchVideoMeta, patchEvent } = useGallery();
  const { toast } = useToast();

  const openImageEditor = useCallback(
    (
      id: string,
      date: string,
      event?: string,
      location?: { lat: number; lng: number } | null,
    ) => {
      const current = location ?? null;
      setEditDraft({
        kind: "image",
        id,
        date: toDateInputValue(date),
        event: event ?? "",
        currentLocation: current,
        pendingLocation: current,
      });
    },
    [],
  );

  const openVideoEditor = useCallback(
    (
      id: string,
      date: string,
      event?: string,
      location?: { lat: number; lng: number } | null,
    ) => {
      const current = location ?? null;
      setEditDraft({
        kind: "video",
        id,
        date: toDateInputValue(date),
        event: event ?? "",
        currentLocation: current,
        pendingLocation: current,
      });
    },
    [],
  );

  const openEventEditor = useCallback(
    (id: string, date: string, title: string, emojiOrDot?: string, mediaIds?: string[]) => {
      setEditDraft({
        kind: "event",
        id,
        originalTitle: title,
        mediaIds: mediaIds ?? [],
        date: toDateInputValue(date),
        title,
        emojiOrDot: emojiOrDot ?? "",
      });
    },
    [],
  );

  const closeEditor = useCallback(() => {
    if (isSavingEdit) return;
    setEditDraft(null);
  }, [isSavingEdit]);

  const saveEdit = useCallback(async () => {
    if (!editDraft || isSavingEdit) return;
    if (!editDraft.date) {
      toast("Please choose a date.", "error");
      return;
    }

    setIsSavingEdit(true);
    const draft = editDraft;
    try {
      if (draft.kind === "event") {
        const title = draft.title.trim();
        if (!title) {
          toast("Event title is required.", "error");
          return;
        }
        const emoji = (draft.emojiOrDot ?? "").trim();
        await updateTimelineEventMetadata({
          id: draft.id,
          date: draft.date,
          title,
          emojiOrDot: emoji,
          originalTitle: draft.originalTitle,
        });

        patchEvent(draft.id, {
          date: draft.date,
          title,
          emojiOrDot: emoji.length > 0 ? emoji : undefined,
        });

        if (draft.originalTitle !== title) {
          const nextEvent = title;
          for (const mediaId of draft.mediaIds) {
            patchImageMeta(mediaId, { event: nextEvent });
            patchVideoMeta(mediaId, { event: nextEvent });
          }
        }
      } else {
        const locationChanged =
          JSON.stringify(draft.currentLocation) !==
          JSON.stringify(draft.pendingLocation);
        await updateMediaMetadata(
          draft.kind,
          draft.id,
          draft.date,
          draft.event,
          locationChanged ? draft.pendingLocation : undefined,
        );

        const trimmedEvent = draft.event.trim();
        const partial: { date: string; event?: string; location?: { lat: number; lng: number } } = {
          date: draft.date,
          event: trimmedEvent.length > 0 ? trimmedEvent : undefined,
        };
        if (locationChanged) {
          partial.location = draft.pendingLocation ?? undefined;
        }
        if (draft.kind === "image") {
          patchImageMeta(draft.id, partial);
        } else {
          patchVideoMeta(draft.id, partial);
        }
      }

      toast(draft.kind === "event" ? "Updated timeline event" : `Updated ${draft.kind} metadata`, "success");
      setEditDraft(null);
    } catch (error) {
      console.error("Failed to update metadata", error);
      toast("Failed to update metadata. Check console for details.", "error");
    } finally {
      setIsSavingEdit(false);
    }
  }, [editDraft, isSavingEdit, patchEvent, patchImageMeta, patchVideoMeta, toast]);

  return {
    editDraft,
    setEditDraft,
    isSavingEdit,
    openImageEditor,
    openVideoEditor,
    openEventEditor,
    closeEditor,
    saveEdit,
  };
}
