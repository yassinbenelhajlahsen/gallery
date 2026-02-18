import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  openModalWithMediaMock,
  resolveVideoThumbUrlMock,
  galleryState,
} = vi.hoisted(() => ({
  openModalWithMediaMock: vi.fn(),
  resolveVideoThumbUrlMock: vi.fn(),
  galleryState: {
    videoMetas: [] as Array<{
      id: string;
      type: "video";
      date: string;
      videoPath: string;
      thumbUrl: string;
      durationSeconds?: number;
      caption?: string;
      event?: string;
    }>,
  },
}));

vi.mock("../../context/GalleryContext", () => ({
  useGallery: () => ({
    videoMetas: galleryState.videoMetas,
    openModalWithMedia: openModalWithMediaMock,
    resolveVideoThumbUrl: resolveVideoThumbUrlMock,
  }),
}));

vi.mock("../../hooks/usePageReveal", () => ({
  usePageReveal: () => true,
}));

vi.mock("../../components/gallery/GalleryGrid", () => ({
  default: ({ tiles }: { tiles: Array<{ id: string; onClick?: () => void }> }) => (
    <div>
      {tiles.map((tile) => (
        <button key={tile.id} onClick={tile.onClick}>
          video-{tile.id}
        </button>
      ))}
    </div>
  ),
}));

import VideosPage from "../../pages/VideosPage";

describe("VideosPage", () => {
  beforeEach(() => {
    galleryState.videoMetas = [
      {
        id: "clip-1.mp4",
        type: "video",
        date: "2024-02-01",
        videoPath: "videos/full/clip-1.mp4",
        thumbUrl: "https://thumb/clip-1.jpg",
        durationSeconds: 31,
      },
      {
        id: "clip-2.mov",
        type: "video",
        date: "2024-01-01",
        videoPath: "videos/full/clip-2.mov",
        thumbUrl: "https://thumb/clip-2.jpg",
      },
    ];

    openModalWithMediaMock.mockReset();
    resolveVideoThumbUrlMock
      .mockReset()
      .mockImplementation((meta) => meta.thumbUrl);
  });

  it("opens modal with full video collection at clicked item", () => {
    render(<VideosPage />);

    fireEvent.click(screen.getByRole("button", { name: "video-clip-2.mov" }));

    expect(openModalWithMediaMock).toHaveBeenCalledWith(galleryState.videoMetas, {
      imageId: "clip-2.mov",
    });
  });
});
