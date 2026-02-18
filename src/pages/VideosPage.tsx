// src/pages/VideosPage.tsx
import React from "react";
import type { VideoMeta } from "../types/mediaTypes";
import GalleryGrid from "../components/gallery/GalleryGrid";
import { useGallery } from "../context/GalleryContext";
import { usePageReveal } from "../hooks/usePageReveal";

type YearGroup = {
  year: string;
  items: VideoMeta[];
};

const VideosPage: React.FC = () => {
  const isVisible = usePageReveal();
  const { videoMetas, openModalWithMedia, resolveVideoThumbUrl } = useGallery();

  const yearGroups = React.useMemo<YearGroup[]>(() => {
    if (!videoMetas.length) return [];
    const map = new Map<string, VideoMeta[]>();

    videoMetas.forEach((meta) => {
      const year = getLocalDate(meta.date).getFullYear().toString();
      const bucket = map.get(year) ?? [];
      bucket.push(meta);
      map.set(year, bucket);
    });

    return Array.from(map.entries())
      .map(([year, items]) => ({
        year,
        items: items.sort(
          (a, b) =>
            getLocalDate(b.date).getTime() - getLocalDate(a.date).getTime(),
        ),
      }))
      .sort((a, b) => Number(b.year) - Number(a.year));
  }, [videoMetas]);

  const handleTileClick = (meta: VideoMeta) => {
    // Open videos modal using the complete videos list (so navigation across videos is possible)
    openModalWithMedia(videoMetas, { imageId: meta.id });
  };

  const renderEmptyState = () => (
    <div className="rounded-4xl border border-dashed border-[#E6F0FF] bg-white/80 px-6 py-10 text-center text-[#777] shadow-inner shadow-white/40">
      <p className="text-lg font-medium">
        No videos yet. Upload to share memories.
      </p>
    </div>
  );

  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-7xl space-y-8 rounded-4xl bg-white/80 p-6 sm:p-10 shadow-[0_35px_120px_rgba(248,180,196,0.25)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-10 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <header className="space-y-4">
            <span className="inline-flex items-center justify-center rounded-full bg-[#F3D0D6]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.4em]">
              Videos
            </span>
          </header>

          {!yearGroups.length && renderEmptyState()}

          {yearGroups.map((group) => (
            <section
              key={group.year}
              className="space-y-4 rounded-3xl bg-white/70 sm:p-6 shadow-lg shadow-[#e6f7ff]/50 ring-1 ring-white/60"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-[#333]">
                  {group.year}
                </h2>
                <span className="rounded-full bg-[#F3D0D6]/70 px-3 py-1 text-sm font-medium text-[#1f4f6f]">
                  {group.items.length} video
                  {group.items.length === 1 ? "" : "s"}
                </span>
              </div>

              <GalleryGrid
                tiles={group.items.map((meta) => ({
                  id: meta.id,
                  url: resolveVideoThumbUrl(meta),
                  caption: meta.caption ?? meta.event,
                  mediaType: "video" as const,
                  durationSeconds: meta.durationSeconds,
                  onClick: () => handleTileClick(meta),
                }))}
                columns={{ base: 2, sm: 2, md: 3, lg: 4 }}
              />
            </section>
          ))}
        </div>
      </div>
    </section>
  );
};

const getLocalDate = (dateString: string) => {
  if (!dateString) return new Date(0);
  const trimmed = dateString.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split("/").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? new Date(0) : new Date(parsed);
};

export default VideosPage;
