import { useEffect, useState } from "react";

type Location = { lat: number; lng: number };

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  borough?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  country?: string;
};

type NominatimReverseResult = {
  name?: string;
  category?: string;
  display_name?: string;
  address?: NominatimAddress;
};

const NAMED_VENUE_CATEGORIES = new Set([
  "tourism",
  "amenity",
  "leisure",
  "historic",
  "building",
  "shop",
]);

const REQUEST_SPACING_MS = 1000;

const cache = new Map<string, string | null>();
let queueTail: Promise<void> = Promise.resolve();

const keyFor = (loc: Location) => `${loc.lat.toFixed(4)}|${loc.lng.toFixed(4)}`;

function formatPlace(r: NominatimReverseResult): string | null {
  const a = r.address ?? {};

  if (r.name && r.category && NAMED_VENUE_CATEGORIES.has(r.category)) {
    return r.name;
  }

  const local = a.neighbourhood || a.suburb || a.quarter || a.hamlet;
  const area = a.borough || a.city_district || a.city || a.town || a.village;
  if (local && area && local !== area) return `${local}, ${area}`;
  if (local) return local;

  const district = a.borough || a.city_district;
  if (district) return district;

  const city = a.city || a.town || a.village || a.municipality || a.county;
  if (city && a.country) return `${city}, ${a.country}`;
  if (city) return city;

  const parts = (r.display_name ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0] ?? null;
}

async function fetchPlaceName(
  loc: Location,
  signal: AbortSignal,
): Promise<string | null> {
  const slot = queueTail.then(
    () => new Promise<void>((resolve) => setTimeout(resolve, REQUEST_SPACING_MS)),
  );
  queueTail = slot.catch(() => undefined);
  await queueTail;

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18` +
    `&lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lng)}`;
  const res = await fetch(url, {
    signal,
    headers: { "Accept-Language": navigator.language || "en" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as NominatimReverseResult;
  return formatPlace(data);
}

export type UseReverseGeocodeResult = {
  placeName: string | null;
  isLoading: boolean;
};

export const __testing = {
  resetCache: () => {
    cache.clear();
    queueTail = Promise.resolve();
  },
  formatPlace,
};

export function useReverseGeocode(
  location: Location | null | undefined,
  enabled: boolean,
): UseReverseGeocodeResult {
  const lat = location?.lat;
  const lng = location?.lng;
  const key =
    enabled && lat !== undefined && lng !== undefined
      ? keyFor({ lat, lng })
      : null;

  const [, bumpCacheVersion] = useState(0);

  useEffect(() => {
    if (!key || lat === undefined || lng === undefined) return;
    if (cache.has(key)) return;

    const controller = new AbortController();
    (async () => {
      try {
        const placeName = await fetchPlaceName(
          { lat, lng },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        cache.set(key, placeName);
        bumpCacheVersion((n) => n + 1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        cache.set(key, null);
        bumpCacheVersion((n) => n + 1);
      }
    })();

    return () => controller.abort();
  }, [key, lat, lng]);

  if (!key) return { placeName: null, isLoading: false };
  if (cache.has(key)) {
    return { placeName: cache.get(key) ?? null, isLoading: false };
  }
  return { placeName: null, isLoading: true };
}
