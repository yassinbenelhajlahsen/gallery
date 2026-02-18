import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchEventsMock,
  fetchAllImageMetadataMock,
  fetchAllVideoMetadataMock,
  loadFromCacheMock,
  syncCacheMock,
  clearCacheMock,
  syncVideoThumbCacheMock,
  loadVideoThumbUrlsFromCacheMock,
  authState,
} = vi.hoisted(() => ({
  fetchEventsMock: vi.fn(),
  fetchAllImageMetadataMock: vi.fn(),
  fetchAllVideoMetadataMock: vi.fn(),
  loadFromCacheMock: vi.fn(),
  syncCacheMock: vi.fn(),
  clearCacheMock: vi.fn(),
  syncVideoThumbCacheMock: vi.fn(),
  loadVideoThumbUrlsFromCacheMock: vi.fn(),
  authState: {
    user: { uid: "u-1" } as { uid: string } | null,
    initializing: false,
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../services/eventsService", () => ({
  fetchEvents: fetchEventsMock,
}));

vi.mock("../../services/storageService", () => ({
  fetchAllImageMetadata: fetchAllImageMetadataMock,
  fetchAllVideoMetadata: fetchAllVideoMetadataMock,
}));

vi.mock("../../services/mediaCacheService", () => ({
  loadFromCache: loadFromCacheMock,
  syncCache: syncCacheMock,
  clearCache: clearCacheMock,
  syncVideoThumbCache: syncVideoThumbCacheMock,
  loadVideoThumbUrlsFromCache: loadVideoThumbUrlsFromCacheMock,
}));

import { GalleryProvider, useGallery } from "../../context/GalleryContext";

const Probe = () => {
  const {
    imageMetas,
    videoMetas,
    events,
    hasGalleryLoadedOnce,
    isGalleryLoading,
    loadError,
    resolveVideoThumbUrl,
    isModalOpen,
    modalInitialIndex,
    modalPreloadAll,
    modalMedia,
    openModalWithImages,
    openModalWithMedia,
    openModalForImageId,
    closeModal,
    refreshEvents,
    refreshGallery,
    resolveThumbUrl,
  } = useGallery();

  const firstVideoThumb = videoMetas[0] ? resolveVideoThumbUrl(videoMetas[0]) : "";
  const firstImageThumb = imageMetas[0] ? resolveThumbUrl(imageMetas[0]) : "";

  return (
    <div>
      <span data-testid="image-count">{imageMetas.length}</span>
      <span data-testid="video-count">{videoMetas.length}</span>
      <span data-testid="events-ids">{events.map((event) => event.id).join(",")}</span>
      <span data-testid="gallery-loaded">{String(hasGalleryLoadedOnce)}</span>
      <span data-testid="gallery-loading">{String(isGalleryLoading)}</span>
      <span data-testid="load-error">{loadError ?? ""}</span>
      <span data-testid="video-thumb-url">{firstVideoThumb}</span>
      <span data-testid="image-thumb-url">{firstImageThumb}</span>
      <span data-testid="modal-open">{String(isModalOpen)}</span>
      <span data-testid="modal-index">{String(modalInitialIndex)}</span>
      <span data-testid="modal-preload">{String(modalPreloadAll)}</span>
      <span data-testid="modal-ids">{modalMedia.map((item) => item.id).join(",")}</span>

      <button
        type="button"
        onClick={() =>
          openModalWithImages(imageMetas, {
            initialIndex: 99,
            imageId: "img-2.jpg",
            preloadAll: true,
          })
        }
      >
        open-images
      </button>
      <button
        type="button"
        onClick={() =>
          openModalWithMedia(
            [
              ...(imageMetas.map((meta) => ({ ...meta, type: "image" as const })) ?? []),
              ...(videoMetas ?? []),
            ],
            {
              initialIndex: 99,
            },
          )
        }
      >
        open-mixed
      </button>
      <button type="button" onClick={() => openModalForImageId("img-2.jpg")}>open-by-id</button>
      <button type="button" onClick={closeModal}>close-modal</button>
      <button type="button" onClick={() => refreshEvents()}>refresh-events</button>
      <button type="button" onClick={() => refreshGallery()}>refresh-gallery</button>
    </div>
  );
};

const defaultImageMetas = [
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
    date: "2024-02-01",
    downloadUrl: "https://full/img-2.jpg",
    thumbUrl: "https://thumb/img-2.jpg",
  },
];

describe("GalleryProvider", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    authState.user = { uid: "u-1" };
    authState.initializing = false;

    fetchEventsMock.mockReset().mockResolvedValue([]);
    fetchAllImageMetadataMock.mockReset().mockResolvedValue(defaultImageMetas);
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
    loadVideoThumbUrlsFromCacheMock.mockReset().mockImplementation(async () => {
      return new Map([["v1.mp4", "blob:cached-v1"]]);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("loads videos even when image metadata is empty", async () => {
    fetchAllImageMetadataMock.mockResolvedValueOnce([]);

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
    expect(screen.getByTestId("video-thumb-url")).toHaveTextContent(
      "blob:cached-v1",
    );
  });

  it("clears cached gallery state when auth user becomes null", async () => {
    const { rerender } = render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("true"),
    );
    expect(clearCacheMock).not.toHaveBeenCalled();

    authState.user = null;
    rerender(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() => expect(clearCacheMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("false"),
    );
  });

  it("applies modal API contracts for open/close and image-id targeting", async () => {
    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "open-images" }));

    expect(screen.getByTestId("modal-open")).toHaveTextContent("true");
    expect(screen.getByTestId("modal-index")).toHaveTextContent("1");
    expect(screen.getByTestId("modal-preload")).toHaveTextContent("true");
    expect(screen.getByTestId("modal-ids")).toHaveTextContent("img-1.jpg,img-2.jpg");

    fireEvent.click(screen.getByRole("button", { name: "close-modal" }));
    expect(screen.getByTestId("modal-open")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "open-by-id" }));
    expect(screen.getByTestId("modal-index")).toHaveTextContent("1");
  });

  it("refreshes events and keeps them sorted newest-first", async () => {
    fetchEventsMock
      .mockResolvedValueOnce([
        { id: "old", date: "2020-01-01", title: "Old", imageIds: [] },
        { id: "new", date: "2024-01-01", title: "New", imageIds: [] },
      ])
      .mockResolvedValueOnce([
        { id: "alpha", date: "2022-05-01", title: "Alpha", imageIds: [] },
        { id: "zeta", date: "2025-05-01", title: "Zeta", imageIds: [] },
      ]);

    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("events-ids")).toHaveTextContent("new,old");
    });

    fireEvent.click(screen.getByRole("button", { name: "refresh-events" }));

    await waitFor(() => {
      expect(screen.getByTestId("events-ids")).toHaveTextContent("zeta,alpha");
    });
  });

  it("sets loadError and still releases the loading gate when image fetch fails", async () => {
    fetchAllImageMetadataMock.mockRejectedValueOnce(new Error("boom"));

    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("load-error")).toHaveTextContent("boom");
    expect(screen.getByTestId("gallery-loading")).toHaveTextContent("false");
  });

  it("refreshes gallery and resets video state when video metadata refresh fails", async () => {
    fetchAllImageMetadataMock
      .mockResolvedValueOnce(defaultImageMetas)
      .mockResolvedValueOnce([
        {
          id: "img-3.jpg",
          storagePath: "images/full/img-3.jpg",
          date: "2024-03-01",
          downloadUrl: "https://full/img-3.jpg",
          thumbUrl: "https://thumb/img-3.jpg",
        },
      ]);
    fetchAllVideoMetadataMock
      .mockResolvedValueOnce([
        {
          id: "v1.mp4",
          type: "video",
          date: "2024-01-01",
          videoPath: "videos/full/v1.mp4",
          thumbUrl: "https://example.com/thumb.jpg",
        },
      ])
      .mockRejectedValueOnce(new Error("video-refresh-fail"));

    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("image-count")).toHaveTextContent("2");
    });

    fireEvent.click(screen.getByRole("button", { name: "refresh-gallery" }));

    await waitFor(() => {
      expect(screen.getByTestId("image-count")).toHaveTextContent("1");
    });

    expect(screen.getByTestId("video-count")).toHaveTextContent("0");
  });

  it("resolves cached image thumb URLs when syncCache returns preloaded blobs", async () => {
    syncCacheMock.mockResolvedValueOnce([
      {
        meta: defaultImageMetas[0],
        blob: new Blob(["x"], { type: "image/jpeg" }),
        objectUrl: "blob:cached-image-1",
      },
    ]);

    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("image-thumb-url")).toHaveTextContent(
      "blob:cached-image-1",
    );
  });

  it("clamps openModalWithMedia index to last item when initial index is too large", async () => {
    render(
      <GalleryProvider>
        <Probe />
      </GalleryProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("gallery-loaded")).toHaveTextContent("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "open-mixed" }));

    expect(screen.getByTestId("modal-open")).toHaveTextContent("true");
    expect(screen.getByTestId("modal-index")).toHaveTextContent("2");
    expect(screen.getByTestId("modal-ids")).toHaveTextContent(
      "img-1.jpg,img-2.jpg,v1.mp4",
    );
  });
});
