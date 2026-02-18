import { useMemo, useState } from "react";
import { useGallery } from "../../context/GalleryContext";
import { useToast } from "../../context/ToastContext";
import {
  buildSearchIndex,
  deleteEventWithLinkedMediaCleanup,
  deleteImageWithMetadata,
  deleteVideoWithMetadata,
  matchesTokens,
  normalizeImageSrc,
  normalizeText,
  toDateInputValue,
  toDateLabel,
  toDateSearchTokens,
  updateMediaMetadata,
  updateTimelineEventMetadata,
} from "../../services/deleteService";
import EditMetadataModal, {
  type EditDraft,
} from "../ui/EditMetadataModal";
import DeleteConfirmModal, {
  type DeleteConfirmModalDraft,
} from "../ui/DeleteConfirmModal";

type DeleteConfirmDraft = DeleteConfirmModalDraft & {
  key: string;
  onConfirm: () => Promise<void>;
};

export default function DeleteTab() {
  const {
    imageMetas,
    videoMetas,
    events,
    refreshGallery,
    refreshEvents,
    resolveThumbUrl,
    resolveVideoThumbUrl,
  } = useGallery();
  const { toast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<DeleteConfirmDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [events],
  );

  const searchTokens = useMemo(() => {
    const normalized = normalizeText(searchQuery);
    if (!normalized) return [];
    return normalized.split(/\s+/).filter(Boolean);
  }, [searchQuery]);
  const hasActiveSearch = searchTokens.length > 0;

  const filteredImageMetas = useMemo(() => {
    if (!hasActiveSearch) return imageMetas;
    return imageMetas.filter((meta) => {
      const index = buildSearchIndex(
        meta.id,
        meta.event,
        ...toDateSearchTokens(meta.date),
      );
      return matchesTokens(index, searchTokens);
    });
  }, [hasActiveSearch, imageMetas, searchTokens]);

  const filteredVideoMetas = useMemo(() => {
    if (!hasActiveSearch) return videoMetas;
    return videoMetas.filter((meta) => {
      const index = buildSearchIndex(
        meta.id,
        meta.event,
        ...toDateSearchTokens(meta.date),
      );
      return matchesTokens(index, searchTokens);
    });
  }, [hasActiveSearch, searchTokens, videoMetas]);

  const filteredEvents = useMemo(() => {
    if (!hasActiveSearch) return sortedEvents;
    return sortedEvents.filter((event) => {
      const index = buildSearchIndex(
        event.title,
        ...toDateSearchTokens(event.date),
        ...(event.imageIds ?? []),
      );
      return matchesTokens(index, searchTokens);
    });
  }, [hasActiveSearch, searchTokens, sortedEvents]);

  const totalMatches =
    filteredImageMetas.length + filteredVideoMetas.length + filteredEvents.length;
  const totalItems = imageMetas.length + videoMetas.length + sortedEvents.length;

  const openDeleteConfirm = (nextDraft: DeleteConfirmDraft) => {
    if (busyKey || isSavingEdit) return;
    setDeleteDraft(nextDraft);
  };

  const requestDeleteImage = (
    id: string,
    fullPath: string,
    thumbPath: string,
  ) => {
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
  };

  const requestDeleteVideo = (
    id: string,
    fullPath: string,
    thumbPath: string,
  ) => {
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
  };

  const requestDeleteEvent = (
    eventId: string,
    eventTitle: string,
    mediaIds: string[],
  ) => {
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
  };

  const openImageEditor = (id: string, date: string, event?: string) => {
    setEditDraft({
      kind: "image",
      id,
      date: toDateInputValue(date),
      event: event ?? "",
    });
  };

  const openVideoEditor = (id: string, date: string, event?: string) => {
    setEditDraft({
      kind: "video",
      id,
      date: toDateInputValue(date),
      event: event ?? "",
    });
  };

  const openEventEditor = (
    id: string,
    date: string,
    title: string,
    emojiOrDot?: string,
    mediaIds?: string[],
  ) => {
    setEditDraft({
      kind: "event",
      id,
      originalTitle: title,
      mediaIds: mediaIds ?? [],
      date: toDateInputValue(date),
      title,
      emojiOrDot: emojiOrDot ?? "",
    });
  };

  const closeEditor = () => {
    if (isSavingEdit) return;
    setEditDraft(null);
  };

  const closeDeleteConfirm = () => {
    if (busyKey) return;
    setDeleteDraft(null);
  };

  const confirmDelete = async () => {
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
  };

  const saveEdit = async () => {
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

        await refreshGallery();
        await refreshEvents();
        toast("Updated timeline event", "success");
      } else {
        await updateMediaMetadata(draft.kind, draft.id, draft.date, draft.event);

        await refreshGallery();
        await refreshEvents();
        toast(`Updated ${draft.kind} metadata`, "success");
      }

      setEditDraft(null);
    } catch (error) {
      console.error("Failed to update metadata", error);
      toast("Failed to update metadata. Check console for details.", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const buttonLabel = (key: string) => {
    if (busyKey === key) return "Deleting...";
    return "Delete";
  };

  const isDeletingCurrentDraft =
    Boolean(deleteDraft) && busyKey === deleteDraft?.key;

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#D24A4A]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-[#7d1f1f]">
          Edit & Delete
        </span>
        <h2 className="text-2xl font-bold text-[#333]">
          Edit & Delete Media & Events
        </h2>
        <p className="text-sm text-[#666]">
          Use Edit to update metadata, or Delete to remove items after confirmation.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/85 p-4">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="delete-search"
            className="text-sm font-semibold text-[#333]"
          >
            Search media and events
          </label>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {hasActiveSearch ? totalMatches : totalItems}
          </span>
        </div>
        <div className="relative">
          <input
            id="delete-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by date, event or file name"
            className="w-full rounded-xl border border-[#ecd6d6] bg-white px-4 py-2.5 text-sm text-[#333] shadow-sm transition-all duration-200 focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/35"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Images</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {filteredImageMetas.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filteredImageMetas.length === 0 ? (
            <p className="text-sm text-[#888]">
              {hasActiveSearch
                ? "No images match your search."
                : "No images found."}
            </p>
          ) : (
            filteredImageMetas.map((meta, index) => {
              const key = `image:${meta.id}`;
              const thumbSrc = normalizeImageSrc(resolveThumbUrl(meta));
              const isOddTail =
                filteredImageMetas.length % 2 === 1 &&
                index === filteredImageMetas.length - 1;
              return (
                <div
                  key={meta.id}
                  className={`flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2 ${isOddTail ? "lg:col-span-2" : ""}`}
                >
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={meta.event ?? meta.id}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-12 w-12 rounded-lg bg-[#f5f5f5]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#333]">
                      {meta.id}
                    </p>
                    <p className="text-xs text-[#777]">
                      {toDateLabel(meta.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || isSavingEdit}
                      onClick={() =>
                        openImageEditor(meta.id, meta.date, meta.event)
                      }
                      className="cursor-pointer rounded-full bg-[#ececec] px-3 py-1.5 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || isSavingEdit}
                      onClick={() =>
                        requestDeleteImage(
                          meta.id,
                          meta.storagePath,
                          `images/thumb/${meta.id}`,
                        )
                      }
                      className="cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {buttonLabel(key)}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Videos</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {filteredVideoMetas.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filteredVideoMetas.length === 0 ? (
            <p className="text-sm text-[#888]">
              {hasActiveSearch
                ? "No videos match your search."
                : "No videos found."}
            </p>
          ) : (
            filteredVideoMetas.map((meta, index) => {
              const key = `video:${meta.id}`;
              const thumbSrc = normalizeImageSrc(
                resolveVideoThumbUrl(meta) || meta.thumbUrl,
              );
              const isOddTail =
                filteredVideoMetas.length % 2 === 1 &&
                index === filteredVideoMetas.length - 1;
              return (
                <div
                  key={meta.id}
                  className={`flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2 ${isOddTail ? "lg:col-span-2" : ""}`}
                >
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={meta.event ?? meta.id}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-12 w-12 rounded-lg bg-[#f5f5f5]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#333]">
                      {meta.id}
                    </p>
                    <p className="text-xs text-[#777]">
                      {toDateLabel(meta.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || isSavingEdit}
                      onClick={() =>
                        openVideoEditor(meta.id, meta.date, meta.event)
                      }
                      className="cursor-pointer rounded-full bg-[#ececec] px-3 py-1.5 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || isSavingEdit}
                      onClick={() =>
                        requestDeleteVideo(
                          meta.id,
                          meta.videoPath,
                          `videos/thumb/${meta.id.replace(/\.[^.]+$/, ".jpg")}`,
                        )
                      }
                      className="cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {buttonLabel(key)}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">
            Timeline Events
          </h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {filteredEvents.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-[#888]">
              {hasActiveSearch
                ? "No timeline events match your search."
                : "No timeline events found."}
            </p>
          ) : (
            filteredEvents.map((event, index) => {
              const key = `event:${event.id}`;
              const isOddTail =
                filteredEvents.length % 2 === 1 &&
                index === filteredEvents.length - 1;
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2 ${isOddTail ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f8f8f8] text-xl">
                    {event.emojiOrDot ?? "•"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#333]">
                      {event.title}
                    </p>
                    <p className="text-xs text-[#777]">
                      {toDateLabel(event.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || isSavingEdit}
                      onClick={() =>
                        openEventEditor(
                          event.id,
                          event.date,
                          event.title,
                          event.emojiOrDot,
                          event.imageIds,
                        )
                      }
                      className="cursor-pointer rounded-full bg-[#ececec] px-3 py-1.5 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyKey) || isSavingEdit}
                      onClick={() =>
                        requestDeleteEvent(event.id, event.title, event.imageIds ?? [])
                      }
                      className="cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {buttonLabel(key)}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <DeleteConfirmModal
        draft={deleteDraft}
        isDeleting={isDeletingCurrentDraft}
        onClose={closeDeleteConfirm}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      <EditMetadataModal
        draft={editDraft}
        isSaving={isSavingEdit}
        onClose={closeEditor}
        onChange={(nextDraft) => setEditDraft(nextDraft)}
        onSave={() => {
          void saveEdit();
        }}
      />
    </div>
  );
}
