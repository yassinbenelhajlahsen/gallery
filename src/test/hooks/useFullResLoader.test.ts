import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFullResLoader } from "../../hooks/useFullResLoader";

describe("useFullResLoader", () => {
  const metas = [
    {
      id: "img-1.jpg",
      storagePath: "images/full/img-1.jpg",
      date: "2024-01-01",
      downloadUrl: "https://full/img-1.jpg",
      thumbUrl: "https://thumb/img-1.jpg",
    },
    {
      id: "img-2.jpg",
      storagePath: "images/full/img-2.jpg",
      date: "2024-01-02",
      downloadUrl: "https://full/img-2.jpg",
      thumbUrl: "https://thumb/img-2.jpg",
    },
  ];

  it("resolves loaded full-res urls and supports eviction", () => {
    const { result } = renderHook(() => useFullResLoader());

    act(() => {
      result.current.requestFullRes(metas);
    });

    expect(result.current.hasFullRes("img-1.jpg")).toBe(true);
    expect(result.current.resolveUrl(metas[0], metas[0].thumbUrl)).toBe(
      "https://full/img-1.jpg",
    );

    act(() => {
      result.current.evict(new Set(["img-2.jpg"]));
    });

    expect(result.current.hasFullRes("img-1.jpg")).toBe(false);
    expect(result.current.hasFullRes("img-2.jpg")).toBe(true);
  });

  it("dedupes repeated requests for the same id", () => {
    const { result } = renderHook(() => useFullResLoader());

    act(() => {
      result.current.requestFullRes([metas[0], metas[0]]);
    });

    expect(result.current.fullResUrls.size).toBe(1);
    expect(Array.from(result.current.fullResUrls.keys())).toEqual(["img-1.jpg"]);
  });
});
