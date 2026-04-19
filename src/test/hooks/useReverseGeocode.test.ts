import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __testing,
  useReverseGeocode,
  warmGeocodeCache,
} from "../../hooks/useReverseGeocode";

const jsonResponse = (data: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  }) as unknown as Response;

const flushQueueAndFetch = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1001);
  });
};

describe("useReverseGeocode", () => {
  beforeEach(() => {
    __testing.resetCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("formatPlace", () => {
    it("returns a named venue when category matches", () => {
      expect(
        __testing.formatPlace({
          name: "Empire State Building",
          category: "tourism",
          address: { city: "New York", country: "United States" },
        }),
      ).toBe("Empire State Building");
    });

    it("ignores name when category is not a named venue", () => {
      expect(
        __testing.formatPlace({
          name: "Some Street",
          category: "highway",
          address: { neighbourhood: "DUMBO", borough: "Brooklyn" },
        }),
      ).toBe("DUMBO, Brooklyn");
    });

    it("combines neighbourhood with borough", () => {
      expect(
        __testing.formatPlace({
          address: {
            neighbourhood: "DUMBO",
            borough: "Brooklyn",
            city: "New York",
          },
        }),
      ).toBe("DUMBO, Brooklyn");
    });

    it("dedupes when local and area are the same", () => {
      expect(
        __testing.formatPlace({
          address: { suburb: "Brooklyn", borough: "Brooklyn" },
        }),
      ).toBe("Brooklyn");
    });

    it("falls back to city + country when no finer field exists", () => {
      expect(
        __testing.formatPlace({
          address: { city: "Paris", country: "France" },
        }),
      ).toBe("Paris, France");
    });

    it("falls back to first two display_name parts when address is empty", () => {
      expect(
        __testing.formatPlace({
          display_name: "Foo, Bar, Baz, Qux",
          address: {},
        }),
      ).toBe("Foo, Bar");
    });

    it("returns null when nothing is available", () => {
      expect(__testing.formatPlace({})).toBeNull();
    });
  });

  it("returns null without fetching when disabled", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useReverseGeocode({ lat: 40.7, lng: -74 }, false),
    );

    expect(result.current.placeName).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null without fetching when location is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useReverseGeocode(null, true));

    expect(result.current.placeName).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and resolves the neighbourhood label", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        address: { neighbourhood: "DUMBO", borough: "Brooklyn" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useReverseGeocode({ lat: 40.7033, lng: -73.9881 }, true),
    );

    await flushQueueAndFetch();

    expect(result.current.placeName).toBe("DUMBO, Brooklyn");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves identical rounded coords from cache without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        address: { neighbourhood: "SoHo", borough: "Manhattan" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() =>
      useReverseGeocode({ lat: 40.72341, lng: -74.00001 }, true),
    );
    await flushQueueAndFetch();
    expect(first.result.current.placeName).toBe("SoHo, Manhattan");

    const second = renderHook(() =>
      useReverseGeocode({ lat: 40.72342, lng: -74.00003 }, true),
    );
    expect(second.result.current.placeName).toBe("SoHo, Manhattan");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("negative-caches a failed fetch so subsequent calls do not retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() =>
      useReverseGeocode({ lat: 10, lng: 20 }, true),
    );
    await flushQueueAndFetch();
    expect(first.result.current.placeName).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() =>
      useReverseGeocode({ lat: 10, lng: 20 }, true),
    );
    expect(second.result.current.placeName).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("completes in-flight requests after navigating away and caches the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        address: { neighbourhood: "TriBeCa", borough: "Manhattan" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      ({ loc }: { loc: { lat: number; lng: number } }) =>
        useReverseGeocode(loc, true),
      { initialProps: { loc: { lat: 40.7163, lng: -74.0086 } } },
    );

    rerender({ loc: { lat: 40.758, lng: -73.9855 } });

    await flushQueueAndFetch();
    await flushQueueAndFetch();

    const revisit = renderHook(() =>
      useReverseGeocode({ lat: 40.7163, lng: -74.0086 }, true),
    );
    expect(revisit.result.current.placeName).toBe("TriBeCa, Manhattan");
  });

  describe("warmGeocodeCache", () => {
    it("fetches uncached coords and dedupes identical keys", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          address: { neighbourhood: "DUMBO", borough: "Brooklyn" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const warmPromise = warmGeocodeCache([
        { lat: 40.7033, lng: -73.9881 },
        { lat: 40.70332, lng: -73.98812 },
      ]);

      await flushQueueAndFetch();
      await warmPromise;

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const { result } = renderHook(() =>
        useReverseGeocode({ lat: 40.7033, lng: -73.9881 }, true),
      );
      expect(result.current.placeName).toBe("DUMBO, Brooklyn");
      expect(result.current.isLoading).toBe(false);
    });

    it("aborts iteration when isCancelled returns true", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          address: { neighbourhood: "DUMBO", borough: "Brooklyn" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await warmGeocodeCache(
        [
          { lat: 1, lng: 2 },
          { lat: 3, lng: 4 },
        ],
        { isCancelled: () => true },
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("dedupes concurrent requests for the same coord", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        address: { neighbourhood: "Harlem", borough: "Manhattan" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const a = renderHook(() =>
      useReverseGeocode({ lat: 40.8116, lng: -73.9465 }, true),
    );
    const b = renderHook(() =>
      useReverseGeocode({ lat: 40.8116, lng: -73.9465 }, true),
    );

    await flushQueueAndFetch();

    expect(a.result.current.placeName).toBe("Harlem, Manhattan");
    expect(b.result.current.placeName).toBe("Harlem, Manhattan");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
