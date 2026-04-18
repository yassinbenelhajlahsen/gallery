// src/pages/VideosPage.tsx
import React from "react";
import type { VideoMeta } from "../types/mediaTypes";
import GalleryGrid from "../components/gallery/GalleryGrid";
import { useGallery } from "../context/GalleryContext";
import { usePageReveal } from "../hooks/usePageReveal";
import { useVideoPagePrefetch } from "../hooks/useVideoPagePrefetch";
import { useYearMonthGrouping } from "../hooks/useYearMonthGrouping";

const VideosPage: React.FC = () => {
  const isVisible = usePageReveal();
  const { videoMetas, isVideoMetadataReady, openModalWithMedia, resolveVideoThumbUrl } = useGallery();
  useVideoPagePrefetch(videoMetas);

  const yearGroups = useYearMonthGrouping(videoMetas);

  const handleTileClick = (meta: VideoMeta) => {
    // Open videos modal using the complete videos list (so navigation across videos is possible)
    openModalWithMedia(videoMetas, { imageId: meta.id });
  };

  const renderEmptyState = () => (
    <div className="border border-dashed border-[#E0E0E0] px-6 py-10 text-center text-[#777]">
      <p className="text-base font-medium">
        No videos yet. Upload videos to get started.
      </p>
    </div>
  );

  return (
    <section className="w-full">
      <div className="mx-auto w-full max-w-350">
        <div
          className={`space-y-10 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <header>
            <h1 className="font-display text-5xl leading-tight text-[#222]">
              Videos
            </h1>
          </header>

          {isVideoMetadataReady && !yearGroups.length && renderEmptyState()}

          {yearGroups.map((group) => (
            <section key={group.year} className="space-y-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-[#E0E0E0] pb-2">
                <h2 className="font-display text-3xl text-[#222]">
                  {group.year}
                </h2>
                <span className="text-sm text-[#555]">
                  {group.totalItems} video{group.totalItems === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-8">
                {group.months.map((monthGroup) => (
                  <section key={monthGroup.key} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#999]">
                      {monthGroup.monthLabel}
                    </h3>

                    <GalleryGrid
                      tiles={monthGroup.items.map((meta) => ({
                        id: meta.id,
                        url: resolveVideoThumbUrl(meta),
                        caption: meta.event,
                        mediaType: "video" as const,
                        durationSeconds: meta.durationSeconds,
                        onClick: () => handleTileClick(meta),
                      }))}
                      columns={{ base: 3, sm: 2, md: 3, lg: 4 }}
                    />
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VideosPage;
