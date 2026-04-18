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
  const { refreshGallery, refreshEvents } = useGallery();
  const { toast } = useToast();

  const openImageEditor = useCallback((id: string, date: string, event?: string) => {
    setEditDraft({ kind: "image", id, date: toDateInputValue(date), event: event ?? "" });
  }, []);

  const openVideoEditor = useCallback((id: string, date: string, event?: string) => {
    setEditDraft({ kind: "video", id, date: toDateInputValue(date), event: event ?? "" });
  }, []);

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
        await updateTimelineEventMetadata({
          id: draft.id,
          date: draft.date,
          title,
          emojiOrDot: draft.emojiOrDot,
          originalTitle: draft.originalTitle,
          mediaIds: draft.mediaIds,
        });
      } else {
        await updateMediaMetadata(draft.kind, draft.id, draft.date, draft.event);
      }

      await refreshGallery();
      await refreshEvents();
      toast(draft.kind === "event" ? "Updated timeline event" : `Updated ${draft.kind} metadata`, "success");
      setEditDraft(null);
    } catch (error) {
      console.error("Failed to update metadata", error);
      toast("Failed to update metadata. Check console for details.", "error");
    } finally {
      setIsSavingEdit(false);
    }
  }, [editDraft, isSavingEdit, refreshGallery, refreshEvents, toast]);

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
