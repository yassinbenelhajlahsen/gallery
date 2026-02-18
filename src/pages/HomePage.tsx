// src/pages/HomePage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useGallery } from "../context/GalleryContext";
import type { ImageMeta } from "../services/storageService";
import { usePageReveal } from "../hooks/usePageReveal";
import { useFullResLoader } from "../hooks/useFullResLoader";
import GalleryGrid from "../components/gallery/GalleryGrid";
import { config } from "../config";

type CloudTile = {
  meta: ImageMeta;
  url: string; // thumbnail URL (shown first)
  fullUrl?: string; // full-res URL (overlays when ready)
  caption?: string;
};

const HOME_TILE_COUNT = 9;
const HOME_TILE_COLUMNS = 3;

const pickRandomSubset = <T,>(items: T[], count: number): T[] => {
  if (count >= items.length) return [...items];
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { imageMetas, openModalWithImages, resolveThumbUrl } = useGallery();
  const isVisible = usePageReveal();
  const { resolveUrl, requestFullRes } = useFullResLoader();

  // Store the *IDs* of chosen tiles so re-renders/re-mounts use the same set
  const [chosenIds, setChosenIds] = React.useState<string[]>([]);

  // Only re-pick when the actual set of available image IDs changes
  const metaIdFingerprint = React.useMemo(
    () => imageMetas.map((m) => m.id).join(","),
    [imageMetas],
  );

  React.useEffect(() => {
    if (!imageMetas.length) {
      setChosenIds([]);
      return;
    }

    setChosenIds((prev) => {
      // If every previously-chosen ID still exists, keep the selection stable
      const available = new Set(imageMetas.map((m) => m.id));
      const allStillExist =
        prev.length > 0 && prev.every((id) => available.has(id));
      if (allStillExist) return prev;

      const desired = Math.min(imageMetas.length, HOME_TILE_COUNT);
      return pickRandomSubset(imageMetas, desired).map((m) => m.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaIdFingerprint]);

  // Kick off full-res loading for the chosen tiles
  const chosenMetas = React.useMemo(
    () =>
      chosenIds
        .map((id) => imageMetas.find((m) => m.id === id))
        .filter(Boolean) as ImageMeta[],
    [chosenIds, imageMetas],
  );

  React.useEffect(() => {
    if (chosenMetas.length) requestFullRes(chosenMetas);
  }, [chosenMetas, requestFullRes]);

  // Build the display tiles from the stable IDs — show thumbnail first,
  // and provide fullUrl for progressive overlay when available.
  const cloudTiles = React.useMemo<CloudTile[]>(() => {
    if (!chosenIds.length || !imageMetas.length) return [];
    return chosenIds
      .map((id) => {
        const meta = imageMetas.find((m) => m.id === id);
        if (!meta) return null;
        const thumb = resolveThumbUrl(meta);
        const fullUrl = resolveUrl(meta, thumb ?? "");
        return {
          meta,
          url: thumb ?? fullUrl,
          fullUrl,
          caption: meta.caption ?? meta.event ?? "Captured memory",
        };
      })
      .filter(Boolean) as CloudTile[];
  }, [chosenIds, imageMetas, resolveUrl, resolveThumbUrl]);

  const handleTileClick = React.useCallback(
    (metaId: string) => {
      if (!cloudTiles.length) return;
      const subset = cloudTiles.map((tile) => tile.meta);
      const index = subset.findIndex((meta) => meta.id === metaId);
      openModalWithImages(subset, {
        initialIndex: index >= 0 ? index : 0,
      });
    },
    [cloudTiles, openModalWithImages],
  );

  const handleSeeAll = () => {
    navigate("/photos", { state: { transition: "fade" } });
  };

  const renderEmptyState = () => (
    <div className="rounded-4xl border border-dashed border-[#FDE2EB] bg-white/80 px-6 py-10 text-center text-[#777] shadow-inner shadow-white/50">
      <p className="text-lg font-medium">
        We’re still fetching your latest memories. They’ll bloom here soon.
      </p>
    </div>
  );

  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-5xl sm:max-w-full rounded-[36px] bg-white/80 p-4 sm:p-10 text-center shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-10 transition-all duration-400 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="space-y-3">
            <p className="text-5xl uppercase tracking-[0.35em] mt-5 mb-15">
              {config.coupleDisplay}
            </p>
          </div>

          {/* If we have no images yet, show the empty state or skeleton. Otherwise
              render a progressive grid using thumbnails and overlay full-res when ready. */}
          {imageMetas.length === 0 ? (
            renderEmptyState()
          ) : cloudTiles.length === 0 ? (
            <div className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-3 sm:gap-4 md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
              {Array.from({ length: chosenIds.length || HOME_TILE_COUNT }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="aspect-square overflow-hidden rounded-2xl bg-white/80 shadow-lg ring-1 ring-white/60"
                  >
                    <div className="skeleton-loader h-full w-full" />
                  </div>
                ),
              )}
            </div>
          ) : (
            <>
              <GalleryGrid
                tiles={cloudTiles.map((tile) => ({
                  id: tile.meta.id,
                  url: tile.url,
                  fullUrl: tile.fullUrl,
                  caption: tile.caption,
                  onClick: () => handleTileClick(tile.meta.id),
                }))}
                columns={{
                  base: HOME_TILE_COLUMNS,
                  sm: HOME_TILE_COLUMNS,
                  md: HOME_TILE_COLUMNS,
                  lg: HOME_TILE_COLUMNS,
                }}
              />

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleSeeAll}
                  className="cursor-pointer  inline-flex items-center gap-3 rounded-full bg-linear-to-r from-[#FFE39F] via-[#FFB1C7] to-[#D8ECFF] px-8 py-3 text-lg font-semibold text-[#2c2c2c] shadow-lg shadow-[#ffe1b8]/60 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation mt-5"
                >
                  See all photos
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomePage;
