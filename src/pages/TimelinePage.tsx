import React from "react";
import TimelineEventItem from "../components/TimelineEventItem";
import type { TimelineEvent } from "../components/TimelineEventItem";
import { useGallery } from "../context/GalleryContext";
import type { ImageMeta } from "../services/storageService";
import type { MediaMeta, VideoMeta } from "../services/mediaTypes";
import { usePageReveal } from "../hooks/usePageReveal";

const normalize = (value?: string | null) => {
  if (!value) return "";
  const result = value
    .trim()
    .toLowerCase()
    // Normalize ALL apostrophe-like characters to regular apostrophe
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Normalize ALL quote-like characters to regular quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  return result;
};

const TimelinePage: React.FC = () => {
  const { imageMetas, videoMetas, openModalWithMedia } = useGallery();
  const isVisible = usePageReveal();

  const { events: timelineEvents } = useGallery();

  const eventMediaMap = React.useMemo(() => {
    const map = new Map<string, MediaMeta[]>();
    const normalizedImageBuckets = new Map<string, ImageMeta[]>();
    const normalizedVideoBuckets = new Map<string, VideoMeta[]>();

    imageMetas.forEach((meta) => {
      const key = normalize(meta.event);
      if (!key) return;
      const bucket = normalizedImageBuckets.get(key) ?? [];
      bucket.push(meta);
      normalizedImageBuckets.set(key, bucket);
    });

    videoMetas.forEach((meta) => {
      const key = normalize(meta.event);
      if (!key) return;
      const bucket = normalizedVideoBuckets.get(key) ?? [];
      bucket.push(meta);
      normalizedVideoBuckets.set(key, bucket);
    });

    timelineEvents.forEach((event) => {
      const matches: MediaMeta[] = [];
      const existingIds = new Set<string>();

      // Explicit IDs are treated as media IDs (image ids or video filenames)
      if (event.imageIds?.length) {
        event.imageIds.forEach((id) => {
          const img = imageMetas.find((m) => m.id === id);
          if (img && !existingIds.has(img.id)) {
            matches.push({ ...img, type: "image" } as const);
            existingIds.add(img.id);
          }
          const vid = videoMetas.find((v) => v.id === id);
          if (vid && !existingIds.has(vid.id)) {
            matches.push(vid);
            existingIds.add(vid.id);
          }
        });
      }

      // Match by event title (union, no duplicates)
      const normalizedEventTitle = normalize(event.title);
      const imgBucket = normalizedImageBuckets.get(normalizedEventTitle) ?? [];
      const vidBucket = normalizedVideoBuckets.get(normalizedEventTitle) ?? [];

      imgBucket.forEach((img) => {
        if (existingIds.has(img.id)) return;
        matches.push({ ...img, type: "image" } as const);
        existingIds.add(img.id);
      });

      vidBucket.forEach((vid) => {
        if (existingIds.has(vid.id)) return;
        matches.push(vid);
        existingIds.add(vid.id);
      });

      // Sort newest-first for stability inside modal
      matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      map.set(event.id, matches);
    });

    return map;
  }, [imageMetas, videoMetas, timelineEvents]);

  const handleEventSelect = React.useCallback(
    (event: TimelineEvent) => {
      const matches = eventMediaMap.get(event.id) ?? [];
      if (!matches.length) return;
      // Timeline is the ONLY place where mixed image+video navigation is allowed.
      openModalWithMedia(matches, { preloadAll: true });
    },
    [eventMediaMap, openModalWithMedia],
  );

  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-7xl space-y-16 rounded-4xl bg-white/80 p-6 sm:p-10 shadow-[0_35px_120px_rgba(248,180,196,0.25)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-10 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <header className="space-y-4">
            <span className="inline-flex items-center justify-center rounded-full bg-[#D8ECFF]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.4em] text-[#1f4f6f]">
              Timeline
            </span>
          </header>

          <ol className="space-y-4">
            {timelineEvents.map((event) => {
              const matches = eventMediaMap.get(event.id) ?? [];
              const mediaCounts = matches.reduce(
                (acc, m) => {
                  if (m.type === "image") acc.imageCount += 1;
                  if (m.type === "video") acc.videoCount += 1;
                  return acc;
                },
                { imageCount: 0, videoCount: 0 },
              );

              return (
                <li key={event.id}>
                  <TimelineEventItem
                    event={event}
                    onSelect={handleEventSelect}
                    mediaCounts={mediaCounts}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default TimelinePage;
