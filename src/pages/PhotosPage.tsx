// src/pages/PhotosPage.tsx
import React from "react";
import type { ImageMeta } from "../services/storageService";
import { useGallery } from "../context/GalleryContext";
import GalleryGrid from "../components/gallery/GalleryGrid";
import { usePageReveal } from "../hooks/usePageReveal";
import { useFullResLoader } from "../hooks/useFullResLoader";
import { isLowBandwidthMobileClient } from "../utils/runtime";

type YearGroup = {
  year: string;
  totalItems: number;
  months: MonthGroup[];
};

type MonthGroup = {
  key: string;
  monthLabel: string;
  items: ImageMeta[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: "long" });

const All: React.FC = () => {
  const { imageMetas, resolveThumbUrl, openModalForImageId } = useGallery();
  const isVisible = usePageReveal();
  const { resolveUrl, requestFullRes, evict } = useFullResLoader();
  const preloadGroups = React.useMemo(
    () => (isLowBandwidthMobileClient() ? 1 : 3),
    [],
  );

  const yearGroups = React.useMemo<YearGroup[]>(() => {
    if (!imageMetas.length) return [];
    const yearMap = new Map<number, Map<number, ImageMeta[]>>();

    imageMetas.forEach((meta) => {
      const localDate = getLocalDate(meta.date);
      const year = localDate.getFullYear();
      const monthIndex = localDate.getMonth();
      const monthMap = yearMap.get(year) ?? new Map<number, ImageMeta[]>();
      const bucket = monthMap.get(monthIndex) ?? [];
      bucket.push(meta);
      monthMap.set(monthIndex, bucket);
      yearMap.set(year, monthMap);
    });

    return Array.from(yearMap.entries())
      .sort(([yearA], [yearB]) => yearB - yearA)
      .map(([year, monthMap]) => {
        const months = Array.from(monthMap.entries())
          .sort(([monthA], [monthB]) => monthB - monthA)
          .map(([monthIndex, items]) => ({
            key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
            monthLabel: MONTH_FORMATTER.format(new Date(year, monthIndex, 1)),
            items: items.sort(
              (a, b) =>
                getLocalDate(b.date).getTime() - getLocalDate(a.date).getTime(),
            ),
          }));

        return {
          year: year.toString(),
          totalItems: months.reduce(
            (count, monthGroup) => count + monthGroup.items.length,
            0,
          ),
          months,
        };
      });
  }, [imageMetas]);

  const monthGroups = React.useMemo(
    () => yearGroups.flatMap((yearGroup) => yearGroup.months),
    [yearGroups],
  );

  const monthIndexByKey = React.useMemo(() => {
    const map = new Map<string, number>();
    monthGroups.forEach((group, index) => {
      map.set(group.key, index);
    });
    return map;
  }, [monthGroups]);

  // Track which month-group indices are currently visible
  const [visibleIndices, setVisibleIndices] = React.useState<Set<number>>(
    new Set(),
  );
  const sectionRefs = React.useRef<Map<number, HTMLElement>>(new Map());

  // IntersectionObserver to detect which month-group sections are on screen
  React.useEffect(() => {
    if (!monthGroups.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIndices((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const idx = Number(entry.target.getAttribute("data-month-index"));
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
  }, [monthGroups.length]);

  // Compute which images need full-res based on visible groups ± PRELOAD_GROUPS
  React.useEffect(() => {
    if (!monthGroups.length || !visibleIndices.size) return;

    // Expand visible indices to include ±PRELOAD_GROUPS
    const wantedGroupIndices = new Set<number>();
    visibleIndices.forEach((idx) => {
      for (let offset = -preloadGroups; offset <= preloadGroups; offset++) {
        const target = idx + offset;
        if (target >= 0 && target < monthGroups.length) {
          wantedGroupIndices.add(target);
        }
      }
    });

    // Collect all metas from wanted groups
    const wantedMetas: ImageMeta[] = [];
    const wantedIds = new Set<string>();
    wantedGroupIndices.forEach((idx) => {
      const group = monthGroups[idx];
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
  }, [visibleIndices, monthGroups, requestFullRes, evict, preloadGroups]);

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

          {yearGroups.map((group) => (
            <section
              key={group.year}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-[#333]">
                  {group.year}
                </h2>
                <span className="rounded-full bg-[#FFE39F]/70 px-3 py-1 text-sm font-medium text-[#8a5a2d]">
                  {group.totalItems} Photo
                  {group.totalItems > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-6">
                {group.months.map((monthGroup) => {
                  const monthIndex = monthIndexByKey.get(monthGroup.key);
                  return (
                    <section
                      key={monthGroup.key}
                      data-month-index={monthIndex}
                      ref={(el) => {
                        if (monthIndex == null) return;
                        if (el) sectionRefs.current.set(monthIndex, el);
                        else sectionRefs.current.delete(monthIndex);
                      }}
                      className="space-y-3 rounded-2xl bg-white/80 p-4 shadow-md ring-1 ring-white/70"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-[#4a4a4a]">
                          {monthGroup.monthLabel}
                        </h3>
                      </div>

                      <GalleryGrid
                        tiles={monthGroup.items.map((meta) => {
                          const thumbUrl = resolveThumbUrl(meta);
                          return {
                            id: meta.id,
                            url: thumbUrl,
                            fullUrl: resolveUrl(meta, thumbUrl),
                            caption: meta.caption ?? meta.event,
                            onClick: () => handleTileClick(meta),
                          };
                        })}
                        columns={{ base: 3, sm: 2, md: 3, lg: 4 }}
                      />
                    </section>
                  );
                })}
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
