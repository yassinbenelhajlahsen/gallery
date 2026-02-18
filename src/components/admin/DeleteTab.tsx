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

const parseLocalDateLike = (dateValue: string): Date | null => {
  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yearRaw, monthRaw, dayRaw] = isoMatch;
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split("/").map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

const toDateLabel = (dateValue: string) => {
  const parsed = parseLocalDateLike(dateValue);
  if (!parsed) return dateValue;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const toDateSearchTokens = (dateValue: string): string[] => {
  const trimmed = dateValue.trim();
  if (!trimmed) return [];

  const tokens = new Set<string>([trimmed.toLowerCase()]);

  const parsed = parseLocalDateLike(trimmed);
  if (parsed) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    tokens.add(`${year}-${mm}-${dd}`);
    tokens.add(`${mm}/${dd}/${year}`);
    tokens.add(`${month}/${day}/${year}`);
  }

  tokens.add(toDateLabel(trimmed).toLowerCase());
  return Array.from(tokens);
};

const buildSearchIndex = (...parts: Array<string | undefined>): string =>
  parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase())
    .join(" ");

const matchesTokens = (index: string, tokens: string[]) =>
  tokens.every((token) => index.includes(token));

const normalizeImageSrc = (src: string | null | undefined): string | null => {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
        meta.caption,
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
        meta.caption,
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

  const removeMediaFromEventRefs = async (mediaId: string) => {
    const eventsWithMedia = await getDocs(
      query(
        collection(db, "events"),
        where("imageIds", "array-contains", mediaId),
      ),
    );

    await Promise.all(
      eventsWithMedia.docs.map(async (eventDoc) => {
        await updateDoc(eventDoc.ref, {
          imageIds: arrayRemove(mediaId),
        });
      }),
    );
  };

  const clearEventFromLinkedMedia = async (
    eventTitle: string,
    mediaIds: string[],
  ) => {
    const batch = writeBatch(db);
    const queuedRefs = new Set<string>();

    const queueClearEvent = (
      collectionName: "images" | "videos",
      id: string,
    ) => {
      const key = `${collectionName}:${id}`;
      if (queuedRefs.has(key)) return;
      queuedRefs.add(key);
      batch.update(doc(db, collectionName, id), { event: null });
    };

    const [imagesByEvent, videosByEvent] = await Promise.all([
      getDocs(
        query(collection(db, "images"), where("event", "==", eventTitle)),
      ),
      getDocs(
        query(collection(db, "videos"), where("event", "==", eventTitle)),
      ),
    ]);

    imagesByEvent.docs.forEach((imageDoc) =>
      queueClearEvent("images", imageDoc.id),
    );
    videosByEvent.docs.forEach((videoDoc) =>
      queueClearEvent("videos", videoDoc.id),
    );

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

  const deleteImage = async (
    id: string,
    fullPath: string,
    thumbPath: string,
  ) => {
    await performDelete(`image:${id}`, async () => {
      const [fullResult, thumbResult] = await Promise.allSettled([
        deleteObject(ref(storage, fullPath)),
        deleteObject(ref(storage, thumbPath)),
      ]);

      const fullError =
        fullResult.status === "rejected" ? fullResult.reason : null;
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

  const deleteVideo = async (
    id: string,
    fullPath: string,
    thumbPath: string,
  ) => {
    await performDelete(`video:${id}`, async () => {
      const [fullResult, thumbResult] = await Promise.allSettled([
        deleteObject(ref(storage, fullPath)),
        deleteObject(ref(storage, thumbPath)),
      ]);

      const fullError =
        fullResult.status === "rejected" ? fullResult.reason : null;
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

  const deleteEvent = async (
    eventId: string,
    eventTitle: string,
    mediaIds: string[],
  ) => {
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
        <h2 className="text-2xl font-bold text-[#333]">
          Delete Media & Events
        </h2>
        <p className="text-sm text-[#666]">
          Click delete once, then click again to confirm.
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
                      alt={meta.caption ?? meta.event ?? meta.id}
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
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      deleteImage(
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
                      alt={meta.caption ?? meta.event ?? meta.id}
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
