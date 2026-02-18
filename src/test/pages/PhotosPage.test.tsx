import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  openModalForImageIdMock,
  resolveThumbUrlMock,
  requestFullResMock,
  resolveUrlMock,
  evictMock,
  galleryState,
} = vi.hoisted(() => ({
  openModalForImageIdMock: vi.fn(),
  resolveThumbUrlMock: vi.fn(),
  requestFullResMock: vi.fn(),
  resolveUrlMock: vi.fn(),
  evictMock: vi.fn(),
  galleryState: {
    imageMetas: [] as Array<{
      id: string;
      storagePath: string;
      date: string;
      downloadUrl: string;
      thumbUrl: string;
      caption?: string;
      event?: string;
    }>,
  },
}));

vi.mock("../../context/GalleryContext", () => ({
  useGallery: () => ({
    imageMetas: galleryState.imageMetas,
    resolveThumbUrl: resolveThumbUrlMock,
    openModalForImageId: openModalForImageIdMock,
  }),
}));

vi.mock("../../hooks/usePageReveal", () => ({
  usePageReveal: () => true,
}));

vi.mock("../../hooks/useFullResLoader", () => ({
  useFullResLoader: () => ({
    resolveUrl: resolveUrlMock,
    requestFullRes: requestFullResMock,
    evict: evictMock,
  }),
}));

vi.mock("../../utils/runtime", () => ({
  isLowBandwidthMobileClient: () => false,
}));

vi.mock("../../components/gallery/GalleryGrid", () => ({
  default: ({ tiles }: { tiles: Array<{ id: string; onClick?: () => void }> }) => (
    <div>
      {tiles.map((tile) => (
        <button key={tile.id} onClick={tile.onClick}>
          photo-{tile.id}
        </button>
      ))}
    </div>
  ),
}));

import PhotosPage from "../../pages/PhotosPage";

describe("PhotosPage", () => {
  beforeEach(() => {
    galleryState.imageMetas = [
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
        date: "2024-01-05",
        downloadUrl: "https://full/img-2.jpg",
        thumbUrl: "https://thumb/img-2.jpg",
      },
    ];

    openModalForImageIdMock.mockReset();
    resolveThumbUrlMock.mockReset().mockImplementation((meta) => meta.thumbUrl);
    requestFullResMock.mockReset();
    resolveUrlMock
      .mockReset()
      .mockImplementation((meta, fallback: string) => fallback || meta.downloadUrl);
    evictMock.mockReset();
  });

  it("requests and evicts full-res windows based on visible month groups", async () => {
    render(<PhotosPage />);

    await waitFor(() => {
      expect(requestFullResMock).toHaveBeenCalled();
    });
    expect(evictMock).toHaveBeenCalled();

    const keepIds = evictMock.mock.calls[0]?.[0] as Set<string>;
    expect(keepIds instanceof Set).toBe(true);
    expect(keepIds.has("img-1.jpg")).toBe(true);
    expect(keepIds.has("img-2.jpg")).toBe(true);
  });

  it("opens modal for clicked image", () => {
    render(<PhotosPage />);

    fireEvent.click(screen.getByRole("button", { name: "photo-img-1.jpg" }));

    expect(openModalForImageIdMock).toHaveBeenCalledWith(
      "img-1.jpg",
      galleryState.imageMetas,
    );
  });
});
