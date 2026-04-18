import { useState, useCallback } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import {
  deleteEventWithLinkedMediaCleanup,
  deleteImageWithMetadata,
  deleteVideoWithMetadata,
} from "../services/deleteService";
import type { DeleteConfirmModalDraft } from "../components/ui/DeleteConfirmModal";

type DeleteConfirmDraft = DeleteConfirmModalDraft & {
  key: string;
  onConfirm: () => Promise<void>;
};

export function useDeleteConfirmation(isSavingEdit: boolean) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<DeleteConfirmDraft | null>(null);
  const { refreshGallery, refreshEvents } = useGallery();
  const { toast } = useToast();

  const openDeleteConfirm = useCallback(
    (nextDraft: DeleteConfirmDraft) => {
      if (busyKey || isSavingEdit) return;
      setDeleteDraft(nextDraft);
    },
    [busyKey, isSavingEdit],
  );

  const requestDeleteImage = useCallback(
    (id: string, fullPath: string, thumbPath: string) => {
      openDeleteConfirm({
        key: `image:${id}`,
        kind: "image",
        title: id,
        onConfirm: async () => {
          await deleteImageWithMetadata(id, fullPath, thumbPath);
          await refreshGallery();
          await refreshEvents();
          toast(`Deleted image ${id}`, "success");
        },
      });
    },
    [openDeleteConfirm, refreshGallery, refreshEvents, toast],
  );

  const requestDeleteVideo = useCallback(
    (id: string, fullPath: string, thumbPath: string) => {
      openDeleteConfirm({
        key: `video:${id}`,
        kind: "video",
        title: id,
        onConfirm: async () => {
          await deleteVideoWithMetadata(id, fullPath, thumbPath);
          await refreshGallery();
          await refreshEvents();
          toast(`Deleted video ${id}`, "success");
        },
      });
    },
    [openDeleteConfirm, refreshGallery, refreshEvents, toast],
  );

  const requestDeleteEvent = useCallback(
    (eventId: string, eventTitle: string, mediaIds: string[]) => {
      openDeleteConfirm({
        key: `event:${eventId}`,
        kind: "event",
        title: eventTitle,
        onConfirm: async () => {
          await deleteEventWithLinkedMediaCleanup(eventId, eventTitle, mediaIds);
          await refreshGallery();
          await refreshEvents();
          toast("Deleted timeline event", "success");
        },
      });
    },
    [openDeleteConfirm, refreshGallery, refreshEvents, toast],
  );

  const closeDeleteConfirm = useCallback(() => {
    if (busyKey) return;
    setDeleteDraft(null);
  }, [busyKey]);

  const confirmDelete = useCallback(async () => {
    if (!deleteDraft || busyKey) return;
    const draft = deleteDraft;
    setBusyKey(draft.key);
    try {
      await draft.onConfirm();
      setDeleteDraft(null);
    } catch (error) {
      if (draft.kind === "event") {
        console.error("Failed to delete event", error);
        toast("Failed to delete timeline event.", "error");
      } else {
        console.error(`Failed to delete ${draft.kind}`, error);
        toast(`Failed to delete ${draft.kind}. Check console for details.`, "error");
      }
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, deleteDraft, toast]);

  const buttonLabel = useCallback(
    (key: string) => (busyKey === key ? "Deleting..." : "Delete"),
    [busyKey],
  );

  const isDeletingCurrentDraft = Boolean(deleteDraft) && busyKey === deleteDraft?.key;

  return {
    busyKey,
    deleteDraft,
    isDeletingCurrentDraft,
    requestDeleteImage,
    requestDeleteVideo,
    requestDeleteEvent,
    closeDeleteConfirm,
    confirmDelete,
    buttonLabel,
  };
}
