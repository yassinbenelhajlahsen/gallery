import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchEventsMock,
  fetchAllImageMetadataMock,
  fetchAllVideoMetadataMock,
  loadFromCacheMock,
  syncCacheMock,
  clearCacheMock,
  syncVideoThumbCacheMock,
  authState,
} = vi.hoisted(() => ({
  fetchEventsMock: vi.fn(),
  fetchAllImageMetadataMock: vi.fn(),
  fetchAllVideoMetadataMock: vi.fn(),
  loadFromCacheMock: vi.fn(),
  syncCacheMock: vi.fn(),
  clearCacheMock: vi.fn(),
  syncVideoThumbCacheMock: vi.fn(),
  authState: {
    user: { uid: "u-1" },
    initializing: false,
  },
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../services/eventsService", () => ({
  fetchEvents: fetchEventsMock,
}));

vi.mock("../services/storageService", () => ({
  fetchAllImageMetadata: fetchAllImageMetadataMock,
  fetchAllVideoMetadata: fetchAllVideoMetadataMock,
}));

vi.mock("../services/mediaCacheService", () => ({
  loadFromCache: loadFromCacheMock,
  syncCache: syncCacheMock,
  clearCache: clearCacheMock,
  syncVideoThumbCache: syncVideoThumbCacheMock,
}));

import { GalleryProvider, useGallery } from "./GalleryContext";

const Probe = () => {
  const { videoMetas, hasGalleryLoadedOnce } = useGallery();
  return (
    <div>
      <span data-testid="video-count">{videoMetas.length}</span>
      <span data-testid="gallery-loaded">{String(hasGalleryLoadedOnce)}</span>
    </div>
  );
};

describe("GalleryProvider smoke flow", () => {
  beforeEach(() => {
    fetchEventsMock.mockReset().mockResolvedValue([]);
    fetchAllImageMetadataMock.mockReset().mockResolvedValue([]);
    fetchAllVideoMetadataMock.mockReset().mockResolvedValue([
      {
        id: "v1.mp4",
        type: "video",
        date: "2024-01-01",
        videoPath: "videos/full/v1.mp4",
        thumbUrl: "https://example.com/thumb.jpg",
      },
    ]);
    loadFromCacheMock.mockReset().mockResolvedValue(null);
    syncCacheMock.mockReset().mockResolvedValue([]);
    clearCacheMock.mockReset().mockResolvedValue(undefined);
    syncVideoThumbCacheMock.mockReset().mockResolvedValue(undefined);
  });

  it("loads videos even when image metadata is empty", async () => {
    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("true"),
    );

    expect(fetchAllImageMetadataMock).toHaveBeenCalledTimes(1);
    expect(fetchAllVideoMetadataMock).toHaveBeenCalledTimes(1);
    expect(syncCacheMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("video-count")).toHaveTextContent("1");
  });
});
