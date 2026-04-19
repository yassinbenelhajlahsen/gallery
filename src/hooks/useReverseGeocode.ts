import { useEffect, useState } from "react";
import {
  loadAllGeocodes,
  saveGeocode,
} from "../services/mediaCacheService";

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
const inflight = new Map<string, Promise<string | null>>();
let queueTail: Promise<void> = Promise.resolve();

let hydrated: Promise<void> = loadAllGeocodes()
  .then((records) => {
    for (const [key, record] of records) {
      if (!cache.has(key)) cache.set(key, record.placeName);
    }
  })
  .catch(() => undefined);

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

function ensurePlaceName(loc: Location): Promise<string | null> {
  const key = keyFor(loc);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const slot = queueTail.then(
      () => new Promise<void>((resolve) => setTimeout(resolve, REQUEST_SPACING_MS)),
    );
    queueTail = slot.catch(() => undefined);
    await queueTail;

    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18` +
        `&lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lng)}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": navigator.language || "en" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NominatimReverseResult;
      const placeName = formatPlace(data);
      cache.set(key, placeName);
      void saveGeocode(key, placeName);
      return placeName;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export type UseReverseGeocodeResult = {
  placeName: string | null;
  isLoading: boolean;
};

export const __testing = {
  resetCache: () => {
    cache.clear();
    inflight.clear();
    queueTail = Promise.resolve();
    hydrated = Promise.resolve();
  },
  formatPlace,
};

/**
 * Pre-fetch and persist geocode results for a batch of coords. Fire-and-forget
 * from callers (e.g. GalleryContext on boot). Respects Nominatim's 1 req/sec
 * cap via the shared queueTail, and skips coords already in the cache.
 */
export async function warmGeocodeCache(
  locations: Array<Location>,
  options?: { isCancelled?: () => boolean },
): Promise<void> {
  await hydrated;
  const seen = new Set<string>();
  for (const loc of locations) {
    if (options?.isCancelled?.()) return;
    const key = keyFor(loc);
    if (seen.has(key)) continue;
    seen.add(key);
    if (cache.has(key)) continue;
    try {
      await ensurePlaceName(loc);
    } catch {
      // swallow — ensurePlaceName already caches null on failure
    }
  }
}

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

    let cancelled = false;

    // Kick off the fetch regardless of component unmount — the result is
    // cached globally and benefits future renders. Only the state update is
    // gated by `cancelled`.
    (async () => {
      if (!cache.has(key)) await hydrated;
      if (!cache.has(key)) await ensurePlaceName({ lat, lng });
      if (cancelled) return;
      bumpCacheVersion((n) => n + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, lat, lng]);

  if (!key) return { placeName: null, isLoading: false };
  if (cache.has(key)) {
    return { placeName: cache.get(key) ?? null, isLoading: false };
  }
  return { placeName: null, isLoading: true };
}
