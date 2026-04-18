import React from "react";
import { useGallery } from "../context/GalleryContext";
import { usePageReveal } from "../hooks/usePageReveal";
import type { ImageMeta } from "../services/storageService";
import type { MediaMeta } from "../types/mediaTypes";
import MapView from "../components/map/MapView";
import "../components/map/mapStyles.css";

type GpsImage = ImageMeta & {
  type: "image";
  location: { lat: number; lng: number };
};

const hasValidLocation = <T extends ImageMeta>(
  m: T,
): m is T & { location: { lat: number; lng: number } } => {
  const loc = m.location;
  if (!loc) return false;
  const { lat, lng } = loc;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

const MapPage: React.FC = () => {
  const { imageMetas, openModalWithMedia } = useGallery();
  const isVisible = usePageReveal();

  const locatedItems = React.useMemo<GpsImage[]>(
    () =>
      imageMetas
        .map((m) => ({ ...m, type: "image" as const }))
        .filter(hasValidLocation),
    [imageMetas],
  );

  const handleClusterSelect = React.useCallback(
    (items: MediaMeta[], tapped: MediaMeta) => {
      openModalWithMedia(items, { imageId: tapped.id, preloadAll: true });
    },
    [openModalWithMedia],
  );

  return (
    <section className="w-full">
      <div className="mx-auto w-full max-w-350">
        <div
          className={`space-y-6 transition-all duration-400 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <header className="space-y-2">
            <h1 className="font-display text-5xl leading-tight text-[#222]">
              Map
            </h1>
          </header>

          {locatedItems.length === 0 ? (
            <div className="border border-dashed border-[#D8D3C7] px-6 py-14 text-center">
              <p className="font-display text-2xl text-[#222]">
                No located photos yet
              </p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-sm border border-[#222] shadow-[0_10px_30px_rgba(34,34,34,0.08)] h-[76svh] min-h-[200px] sm:h-[80vh] sm:min-h-[550px] [@media(display-mode:standalone)]:h-[calc(100svh-180px)] [@media(display-mode:standalone)]:sm:h-[calc(100vh-160px)]">
              <MapView
                items={locatedItems}
                onClusterSelect={handleClusterSelect}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MapPage;
