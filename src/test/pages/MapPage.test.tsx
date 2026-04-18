import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openModalWithMediaMock, galleryState } = vi.hoisted(() => ({
  openModalWithMediaMock: vi.fn(),
  galleryState: {
    imageMetas: [] as Array<{
      id: string;
      type?: "image";
      date: string;
      event?: string;
      caption?: string;
      storagePath: string;
      downloadUrl: string;
      thumbUrl: string;
      location?: { lat: number; lng: number };
    }>,
    videoMetas: [] as Array<{
      id: string;
      type: "video";
      date: string;
      event?: string;
      caption?: string;
      videoPath: string;
      thumbUrl: string;
      location?: { lat: number; lng: number };
    }>,
  },
}));

vi.mock("../../context/GalleryContext", () => ({
  useGallery: () => ({
    imageMetas: galleryState.imageMetas,
    videoMetas: galleryState.videoMetas,
    openModalWithMedia: openModalWithMediaMock,
  }),
}));

vi.mock("../../hooks/usePageReveal", () => ({
  usePageReveal: () => true,
}));

vi.mock("../../components/map/mapStyles.css", () => ({}));

// Leaflet doesn't run in jsdom — replace MapView with a stub that exposes
// every item as a button so we can assert the cluster-select wiring.
vi.mock("../../components/map/MapView", () => ({
  __esModule: true,
  default: ({
    items,
    onClusterSelect,
  }: {
    items: Array<{
      id: string;
      date: string;
      location: { lat: number; lng: number };
    }>;
    onClusterSelect: (
      items: Array<{ id: string; date: string; location: { lat: number; lng: number } }>,
      tapped: { id: string; date: string; location: { lat: number; lng: number } },
    ) => void;
  }) => (
    <div data-testid="map-view-stub">
      <span data-testid="pin-count">{items.length}</span>
      <button
        type="button"
        onClick={() => items.length && onClusterSelect(items, items[0])}
      >
        open-cluster
      </button>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onClusterSelect([item], item)}
        >
          pin-{item.id}
        </button>
      ))}
    </div>
  ),
}));

import MapPage from "../../pages/MapPage";

describe("MapPage", () => {
  beforeEach(() => {
    galleryState.imageMetas = [
      {
        id: "img-located.jpg",
        date: "2024-07-01",
        event: "Paris",
        storagePath: "images/full/img-located.jpg",
        downloadUrl: "https://full/img-located.jpg",
        thumbUrl: "https://thumb/img-located.jpg",
        location: { lat: 48.8566, lng: 2.3522 },
      },
      {
        id: "img-located-2.jpg",
        date: "2024-07-02",
        event: "Paris",
        storagePath: "images/full/img-located-2.jpg",
        downloadUrl: "https://full/img-located-2.jpg",
        thumbUrl: "https://thumb/img-located-2.jpg",
        location: { lat: 48.86, lng: 2.35 },
      },
      {
        id: "img-no-gps.jpg",
        date: "2024-07-03",
        storagePath: "images/full/img-no-gps.jpg",
        downloadUrl: "https://full/img-no-gps.jpg",
        thumbUrl: "https://thumb/img-no-gps.jpg",
      },
    ];

    galleryState.videoMetas = [
      {
        id: "vid-located.mp4",
        type: "video",
        date: "2024-07-04",
        videoPath: "videos/full/vid-located.mp4",
        thumbUrl: "https://thumb/vid-located.jpg",
        location: { lat: 40.7128, lng: -74.006 },
      },
    ];

    openModalWithMediaMock.mockReset();
  });

  it("renders images and videos with valid location", () => {
    render(<MapPage />);
    expect(screen.getByTestId("pin-count").textContent).toBe("3");
    expect(
      screen.getByRole("button", { name: "pin-vid-located.mp4" }),
    ).toBeInTheDocument();
  });

  it("opens modal with cluster items and the tapped id", () => {
    render(<MapPage />);

    fireEvent.click(screen.getByRole("button", { name: "open-cluster" }));

    expect(openModalWithMediaMock).toHaveBeenCalledTimes(1);
    const [mediaArg, optionsArg] = openModalWithMediaMock.mock.calls[0] ?? [];
    expect(Array.isArray(mediaArg)).toBe(true);
    expect((mediaArg as Array<{ id: string }>).map((i) => i.id)).toEqual([
      "img-located.jpg",
      "img-located-2.jpg",
      "vid-located.mp4",
    ]);
    expect(optionsArg).toEqual({
      imageId: "img-located.jpg",
      preloadAll: true,
    });
  });

  it("opens modal with a single-item context when a pin is tapped", () => {
    render(<MapPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "pin-img-located-2.jpg" }),
    );

    expect(openModalWithMediaMock).toHaveBeenCalledTimes(1);
    const [mediaArg, optionsArg] = openModalWithMediaMock.mock.calls[0] ?? [];
    expect((mediaArg as Array<{ id: string }>).map((i) => i.id)).toEqual([
      "img-located-2.jpg",
    ]);
    expect(optionsArg).toEqual({
      imageId: "img-located-2.jpg",
      preloadAll: true,
    });
  });

  it("renders empty state when no photos have a location", () => {
    galleryState.imageMetas = [
      {
        id: "img-no-gps.jpg",
        date: "2024-07-03",
        storagePath: "images/full/img-no-gps.jpg",
        downloadUrl: "https://full/img-no-gps.jpg",
        thumbUrl: "https://thumb/img-no-gps.jpg",
      },
    ];
    galleryState.videoMetas = [];

    render(<MapPage />);

    expect(screen.getByText(/No located photos yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("map-view-stub")).not.toBeInTheDocument();
  });

  it("rejects invalid GPS coordinates (out-of-range, 0/0, NaN)", () => {
    galleryState.imageMetas = [
      {
        id: "img-zero.jpg",
        date: "2024-07-03",
        storagePath: "images/full/img-zero.jpg",
        downloadUrl: "https://full/img-zero.jpg",
        thumbUrl: "https://thumb/img-zero.jpg",
        location: { lat: 0, lng: 0 },
      },
      {
        id: "img-out-of-range.jpg",
        date: "2024-07-04",
        storagePath: "images/full/img-out-of-range.jpg",
        downloadUrl: "https://full/img-out-of-range.jpg",
        thumbUrl: "https://thumb/img-out-of-range.jpg",
        location: { lat: 999, lng: 999 },
      },
      {
        id: "img-ok.jpg",
        date: "2024-07-05",
        storagePath: "images/full/img-ok.jpg",
        downloadUrl: "https://full/img-ok.jpg",
        thumbUrl: "https://thumb/img-ok.jpg",
        location: { lat: 48.8566, lng: 2.3522 },
      },
    ];
    galleryState.videoMetas = [];

    render(<MapPage />);
    expect(screen.getByTestId("pin-count").textContent).toBe("1");
  });
});
