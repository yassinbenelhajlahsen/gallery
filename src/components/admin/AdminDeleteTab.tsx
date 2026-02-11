import { useEffect, useMemo, useState } from "react";
import { deleteObject, ref } from "firebase/storage";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { storage } from "../../services/firebaseStorage";
import { db } from "../../services/firebaseFirestore";
import { useGallery } from "../../context/GalleryContext";
import { useToast } from "../../context/ToastContext";

const isStorageObjectMissing = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  return code === "storage/object-not-found";
};

const toDateLabel = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const parsed = Date.parse(dateValue);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return dateValue;
};

export default function AdminDeleteTab() {
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
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmKey) return;
    const timeout = setTimeout(() => {
      setConfirmKey((current) => (current === confirmKey ? null : current));
    }, 4000);
    return () => clearTimeout(timeout);
  }, [confirmKey]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [events],
  );

  const removeMediaFromEventRefs = async (mediaId: string) => {
    const eventsWithMedia = await getDocs(
      query(collection(db, "events"), where("imageIds", "array-contains", mediaId)),
    );

    await Promise.all(
      eventsWithMedia.docs.map(async (eventDoc) => {
        await updateDoc(eventDoc.ref, {
          imageIds: arrayRemove(mediaId),
        });
      }),
    );
  };

  const clearEventFromLinkedMedia = async (eventTitle: string, mediaIds: string[]) => {
    const batch = writeBatch(db);
    const queuedRefs = new Set<string>();

    const queueClearEvent = (collectionName: "images" | "videos", id: string) => {
      const key = `${collectionName}:${id}`;
      if (queuedRefs.has(key)) return;
      queuedRefs.add(key);
      batch.update(doc(db, collectionName, id), { event: null });
    };

    const [imagesByEvent, videosByEvent] = await Promise.all([
      getDocs(query(collection(db, "images"), where("event", "==", eventTitle))),
      getDocs(query(collection(db, "videos"), where("event", "==", eventTitle))),
    ]);

    imagesByEvent.docs.forEach((imageDoc) => queueClearEvent("images", imageDoc.id));
    videosByEvent.docs.forEach((videoDoc) => queueClearEvent("videos", videoDoc.id));

    await Promise.all(
      mediaIds.map(async (mediaId) => {
        const [imageDoc, videoDoc] = await Promise.all([
          getDoc(doc(db, "images", mediaId)),
          getDoc(doc(db, "videos", mediaId)),
        ]);
        if (imageDoc.exists()) queueClearEvent("images", mediaId);
        if (videoDoc.exists()) queueClearEvent("videos", mediaId);
      }),
    );

    if (queuedRefs.size > 0) {
      await batch.commit();
    }
  };

  const performDelete = async (key: string, onDelete: () => Promise<void>) => {
    if (busyKey) return;

    if (confirmKey !== key) {
      setConfirmKey(key);
      return;
    }

    setConfirmKey(null);
    setBusyKey(key);
    try {
      await onDelete();
    } finally {
      setBusyKey(null);
    }
  };

  const deleteImage = async (id: string, fullPath: string, thumbPath: string) => {
    await performDelete(`image:${id}`, async () => {
      const [fullResult, thumbResult] = await Promise.allSettled([
        deleteObject(ref(storage, fullPath)),
        deleteObject(ref(storage, thumbPath)),
      ]);

      const fullError = fullResult.status === "rejected" ? fullResult.reason : null;
      const thumbError =
        thumbResult.status === "rejected" ? thumbResult.reason : null;

      if (fullError && !isStorageObjectMissing(fullError)) throw fullError;
      if (thumbError && !isStorageObjectMissing(thumbError)) throw thumbError;

      await deleteDoc(doc(db, "images", id));
      await removeMediaFromEventRefs(id);
      await refreshGallery();
      await refreshEvents();
      toast(`Deleted image ${id}`, "success");
    }).catch((error) => {
      console.error("Failed to delete image", error);
      toast("Failed to delete image. Check console for details.", "error");
    });
  };

  const deleteVideo = async (id: string, fullPath: string, thumbPath: string) => {
    await performDelete(`video:${id}`, async () => {
      const [fullResult, thumbResult] = await Promise.allSettled([
        deleteObject(ref(storage, fullPath)),
        deleteObject(ref(storage, thumbPath)),
      ]);

      const fullError = fullResult.status === "rejected" ? fullResult.reason : null;
      const thumbError =
        thumbResult.status === "rejected" ? thumbResult.reason : null;

      if (fullError && !isStorageObjectMissing(fullError)) throw fullError;
      if (thumbError && !isStorageObjectMissing(thumbError)) throw thumbError;

      await deleteDoc(doc(db, "videos", id));
      await removeMediaFromEventRefs(id);
      await refreshGallery();
      await refreshEvents();
      toast(`Deleted video ${id}`, "success");
    }).catch((error) => {
      console.error("Failed to delete video", error);
      toast("Failed to delete video. Check console for details.", "error");
    });
  };

  const deleteEvent = async (eventId: string, eventTitle: string, mediaIds: string[]) => {
    await performDelete(`event:${eventId}`, async () => {
      await clearEventFromLinkedMedia(eventTitle, mediaIds);
      await deleteDoc(doc(db, "events", eventId));
      await refreshGallery();
      await refreshEvents();
      toast("Deleted timeline event", "success");
    }).catch((error) => {
      console.error("Failed to delete event", error);
      toast("Failed to delete timeline event.", "error");
    });
  };

  const buttonLabel = (key: string) => {
    if (busyKey === key) return "Deleting...";
    if (confirmKey === key) return "Confirm Delete";
    return "Delete";
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#D24A4A]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-[#7d1f1f]">
          Delete
        </span>
        <h2 className="text-2xl font-bold text-[#333]">Delete Media & Events</h2>
        <p className="text-sm text-[#666]">
          Click delete once, then click again within 4 seconds to confirm.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Images</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {imageMetas.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {imageMetas.length === 0 ? (
            <p className="text-sm text-[#888]">No images found.</p>
          ) : (
            imageMetas.map((meta) => {
              const key = `image:${meta.id}`;
              return (
                <div
                  key={meta.id}
                  className="flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2"
                >
                  <img
                    src={resolveThumbUrl(meta)}
                    alt={meta.caption ?? meta.event ?? meta.id}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#333]">{meta.id}</p>
                    <p className="text-xs text-[#777]">{toDateLabel(meta.date)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      deleteImage(meta.id, meta.storagePath, `images/thumb/${meta.id}`)
                    }
                    className="cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {buttonLabel(key)}
                  </button>
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
            {videoMetas.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {videoMetas.length === 0 ? (
            <p className="text-sm text-[#888]">No videos found.</p>
          ) : (
            videoMetas.map((meta) => {
              const key = `video:${meta.id}`;
              return (
                <div
                  key={meta.id}
                  className="flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2"
                >
                  <img
                    src={resolveVideoThumbUrl(meta)}
                    alt={meta.caption ?? meta.event ?? meta.id}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#333]">{meta.id}</p>
                    <p className="text-xs text-[#777]">{toDateLabel(meta.date)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      deleteVideo(
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
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Timeline Events</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {sortedEvents.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-[#888]">No timeline events found.</p>
          ) : (
            sortedEvents.map((event) => {
              const key = `event:${event.id}`;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f8f8f8] text-xl">
                    {event.emojiOrDot ?? "•"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#333]">{event.title}</p>
                    <p className="text-xs text-[#777]">{toDateLabel(event.date)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      deleteEvent(event.id, event.title, event.imageIds ?? [])
                    }
                    className="cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {buttonLabel(key)}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
