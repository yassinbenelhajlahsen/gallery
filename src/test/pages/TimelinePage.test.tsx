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
    }>,
    videoMetas: [] as Array<{
      id: string;
      type: "video";
      date: string;
      event?: string;
      caption?: string;
      videoPath: string;
      thumbUrl: string;
    }>,
    events: [] as Array<{
      id: string;
      date: string;
      title: string;
      imageIds?: string[];
      emojiOrDot?: string;
    }>,
  },
}));

vi.mock("../../context/GalleryContext", () => ({
  useGallery: () => ({
    imageMetas: galleryState.imageMetas,
    videoMetas: galleryState.videoMetas,
    events: galleryState.events,
    openModalWithMedia: openModalWithMediaMock,
  }),
}));

vi.mock("../../hooks/usePageReveal", () => ({
  usePageReveal: () => true,
}));

import TimelinePage from "../../pages/TimelinePage";

describe("TimelinePage", () => {
  beforeEach(() => {
    galleryState.imageMetas = [
      {
        id: "img-1.jpg",
        date: "2024-07-01",
        event: "Trip’s Day",
        storagePath: "images/full/img-1.jpg",
        downloadUrl: "https://full/img-1.jpg",
        thumbUrl: "https://thumb/img-1.jpg",
      },
      {
        id: "img-2.jpg",
        date: "2024-07-02",
        event: "Trip’s Day",
        storagePath: "images/full/img-2.jpg",
        downloadUrl: "https://full/img-2.jpg",
        thumbUrl: "https://thumb/img-2.jpg",
      },
    ];

    galleryState.videoMetas = [
      {
        id: "vid-1.mp4",
        type: "video",
        date: "2024-07-03",
        event: "Trip's Day",
        videoPath: "videos/full/vid-1.mp4",
        thumbUrl: "https://thumb/vid-1.jpg",
      },
    ];

    galleryState.events = [
      {
        id: "event-1",
        date: "2024-07-05",
        title: "Trip's Day",
        imageIds: ["img-1.jpg", "vid-1.mp4"],
      },
    ];

    openModalWithMediaMock.mockReset();
  });

  it("unions explicit IDs + title matches, dedupes media, and opens mixed modal", () => {
    render(<TimelinePage />);

    expect(screen.getByText("2 photos • 1 video")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /trip's day/i }));

    expect(openModalWithMediaMock).toHaveBeenCalledTimes(1);
    const [mediaArg, optionsArg] = openModalWithMediaMock.mock.calls[0] ?? [];

    expect(Array.isArray(mediaArg)).toBe(true);
    expect(mediaArg.map((item: { id: string }) => item.id)).toEqual([
      "vid-1.mp4",
      "img-2.jpg",
      "img-1.jpg",
    ]);
    expect(optionsArg).toEqual({ preloadAll: true });
  });
});
