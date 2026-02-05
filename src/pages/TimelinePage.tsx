import React from "react";
import { Link } from "react-router-dom";
import TimelineEventItem from "../components/TimelineEventItem";
import type { TimelineEvent } from "../components/TimelineEventItem";
import eventsData from "../assets/events.json";
import { useGallery } from "../context/GalleryContext";
import type { ImageMeta } from "../services/storageService";
import { usePageReveal } from "../hooks/usePageReveal";

const timelineEvents: TimelineEvent[] = [
  ...(eventsData as TimelineEvent[]),
].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

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
  const { imageMetas, openModalWithImages } = useGallery();
  const isVisible = usePageReveal();

  const eventImageMap = React.useMemo(() => {
    const map = new Map<string, ImageMeta[]>();
    const normalizedMetaBuckets = new Map<string, ImageMeta[]>();

    // Build buckets of images grouped by normalized event name
    imageMetas.forEach((meta) => {
      const key = normalize(meta.event);
      if (!key) return;
      const bucket = normalizedMetaBuckets.get(key) ?? [];
      bucket.push(meta);
      normalizedMetaBuckets.set(key, bucket);
    });

    timelineEvents.forEach((event) => {
      let matches: ImageMeta[] = [];

      // First try explicit imageIds
      if (event.imageIds?.length) {
        matches = event.imageIds
          .map((imageId) => imageMetas.find((meta) => meta.id === imageId))
          .filter((meta): meta is ImageMeta => Boolean(meta));
      }

      // ALSO try matching by event name (this adds images uploaded with matching event metadata)
      const normalizedEventTitle = normalize(event.title);
      const bucket = normalizedMetaBuckets.get(normalizedEventTitle);

      if (bucket?.length) {
        // Merge bucket images with explicit imageIds, avoiding duplicates
        const existingIds = new Set(matches.map((m) => m.id));
        const additionalImages = bucket.filter(
          (img) => !existingIds.has(img.id),
        );
        matches = [...matches, ...additionalImages];
      }

      map.set(event.id, matches);
    });

    return map;
  }, [imageMetas]);

  const handleEventSelect = React.useCallback(
    (event: TimelineEvent) => {
      const matches = eventImageMap.get(event.id) ?? [];
      if (!matches.length) return;
      openModalWithImages(matches, { preloadAll: true });
    },
    [eventImageMap, openModalWithImages],
  );

  return (
    <section className="flex w-full justify-center">
      <div
        className={`mx-auto w-full max-w-4xl sm:max-w-full space-y-8 rounded-4xl bg-white/80 p-10 shadow-[0_35px_120px_rgba(248,180,196,0.25)] ring-1 ring-white/60 backdrop-blur-2xl transition-all duration-400 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <header className="space-y-4 text-center sm:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#D8ECFF]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.4em]">
            Timeline
          </span>
        </header>

        <ol className="space-y-4">
          {timelineEvents.map((event) => (
            <li key={event.id}>
              <TimelineEventItem
                event={event}
                onSelect={handleEventSelect}
                linkedImageCount={eventImageMap.get(event.id)?.length ?? 0}
              />
            </li>
          ))}
        </ol>

        <div className="flex justify-center pt-6">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-full bg-[#F7DEE2]/80 px-5 py-2 text-sm font-semibold text-[#3f3f3f] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F7DEE2] hover:scale-105 active:scale-95 touch-manipulation"
          >
            Upload Images
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default TimelinePage;
