// src/pages/PhotosPage.tsx
import React from "react";
import type { ImageMeta } from "../services/storageService";
import { useGallery } from "../context/GalleryContext";
import GalleryGrid from "../components/GalleryGrid";
import { usePageReveal } from "../hooks/usePageReveal";
import { useFullResLoader } from "../hooks/useFullResLoader";

type YearGroup = {
  year: string;
  items: ImageMeta[];
};

/** How many year-groups ahead/behind the visible one to preload full-res */
const isMobile =
    window.innerWidth < 640 || navigator.connection?.saveData === true;
const PRELOAD_GROUPS = isMobile ? 1 : 3;

const All: React.FC = () => {
  const { imageMetas, resolveThumbUrl, openModalForImageId } = useGallery();
  const isVisible = usePageReveal();
  const { resolveUrl, requestFullRes, evict } = useFullResLoader();

  const yearGroups = React.useMemo<YearGroup[]>(() => {
    if (!imageMetas.length) return [];
    const map = new Map<string, ImageMeta[]>();

    imageMetas.forEach((meta) => {
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
  }, [imageMetas]);

  // Track which year-group indices are currently visible
  const [visibleIndices, setVisibleIndices] = React.useState<Set<number>>(
    new Set(),
  );
  const sectionRefs = React.useRef<Map<number, HTMLElement>>(new Map());

  // IntersectionObserver to detect which year-group sections are on screen
  React.useEffect(() => {
    if (!yearGroups.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIndices((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const idx = Number(entry.target.getAttribute("data-group-index"));
            if (!Number.isNaN(idx)) {
              if (entry.isIntersecting) {
                next.add(idx);
              } else {
                next.delete(idx);
              }
            }
          });
          // Only update state if changed
          if (next.size !== prev.size || [...next].some((v) => !prev.has(v))) {
            return next;
          }
          return prev;
        });
      },
      { rootMargin: "200px 0px", threshold: 0 },
    );

    sectionRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [yearGroups.length]);

  // Compute which images need full-res based on visible groups ± PRELOAD_GROUPS
  React.useEffect(() => {
    if (!yearGroups.length || !visibleIndices.size) return;

    // Expand visible indices to include ±PRELOAD_GROUPS
    const wantedGroupIndices = new Set<number>();
    visibleIndices.forEach((idx) => {
      for (let offset = -PRELOAD_GROUPS; offset <= PRELOAD_GROUPS; offset++) {
        const target = idx + offset;
        if (target >= 0 && target < yearGroups.length) {
          wantedGroupIndices.add(target);
        }
      }
    });

    // Collect all metas from wanted groups
    const wantedMetas: ImageMeta[] = [];
    const wantedIds = new Set<string>();
    wantedGroupIndices.forEach((idx) => {
      const group = yearGroups[idx];
      if (group) {
        group.items.forEach((meta) => {
          wantedMetas.push(meta);
          wantedIds.add(meta.id);
        });
      }
    });

    // Request full-res for wanted, evict the rest
    requestFullRes(wantedMetas);
    evict(wantedIds);
  }, [visibleIndices, yearGroups, requestFullRes, evict]);

  const handleTileClick = (meta: ImageMeta) => {
    openModalForImageId(meta.id, imageMetas);
  };

  const renderEmptyState = () => (
    <div className="rounded-4xl border border-dashed border-[#FDE2EB] bg-white/80 px-6 py-10 text-center text-[#777] shadow-inner shadow-white/40">
      <p className="text-lg font-medium">
        No images yet. Upload memories to see them bloom here.
      </p>
    </div>
  );

  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-7xl rounded-4xl bg-white/85 p-6 sm:p-10 shadow-[0_35px_120px_rgba(248,180,196,0.25)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-10 transition-all duration-400 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <header className="space-y-4">
            <span className="inline-flex items-center justify-center rounded-full bg-[#FFE39F]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.4em] text-[#9a6b2c]">
              Photos
            </span>
          </header>

          {!yearGroups.length && renderEmptyState()}

          {yearGroups.map((group, groupIndex) => (
            <section
              key={group.year}
              data-group-index={groupIndex}
              ref={(el) => {
                if (el) sectionRefs.current.set(groupIndex, el);
                else sectionRefs.current.delete(groupIndex);
              }}
              className="space-y-4 rounded-3xl bg-white/70 p-4 sm:p-6 shadow-lg shadow-[#ffe7f1]/50 ring-1 ring-white/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-[#333]">
                  {group.year}
                </h2>
                <span className="rounded-full bg-[#FFE39F]/70 px-3 py-1 text-sm font-medium text-[#8a5a2d]">
                  {group.items.length} memor
                  {group.items.length === 1 ? "y" : "ies"}
                </span>
              </div>

              <div className="mx-0 sm:mx-0">
                <GalleryGrid
                  tiles={group.items.map((meta) => {
                    const thumbUrl = resolveThumbUrl(meta);
                    return {
                      id: meta.id,
                      url: thumbUrl,
                      fullUrl: resolveUrl(meta, thumbUrl),
                      caption: meta.caption ?? meta.event,
                      onClick: () => handleTileClick(meta),
                    };
                  })}
                  columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
                />
              </div>
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
    const [, year, month, day] = isoMatch.map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split("/").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? new Date(0) : new Date(parsed);
};

export default All;
