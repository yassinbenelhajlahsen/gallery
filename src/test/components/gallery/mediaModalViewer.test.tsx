import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getVideoDownloadUrlMock } = vi.hoisted(() => ({
  getVideoDownloadUrlMock: vi.fn(),
}));

vi.mock("../../../services/storageService", () => ({
  getVideoDownloadUrl: getVideoDownloadUrlMock,
}));

vi.mock("../../../utils/runtime", () => ({
  isLowBandwidthMobileClient: () => false,
}));

import MediaModalViewer from "../../../components/gallery/mediaModalViewer";

const imageMedia = [
  {
    id: "img-1.jpg",
    type: "image" as const,
    date: "2024-01-01",
    thumbUrl: "https://thumb/img-1.jpg",
    downloadUrl: "https://full/img-1.jpg",
    storagePath: "images/full/img-1.jpg",
  },
  {
    id: "img-2.jpg",
    type: "image" as const,
    date: "2024-01-02",
    thumbUrl: "https://thumb/img-2.jpg",
    downloadUrl: "https://full/img-2.jpg",
    storagePath: "images/full/img-2.jpg",
  },
];

const videoMedia = [
  {
    id: "clip-1.mp4",
    type: "video" as const,
    date: "2024-02-02",
    videoPath: "videos/full/clip-1.mp4",
    thumbUrl: "https://thumb/clip-1.jpg",
  },
];

describe("mediaModalViewer", () => {
  beforeEach(() => {
    getVideoDownloadUrlMock.mockReset().mockResolvedValue("https://video/clip-1.mp4");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when modal is closed", () => {
    const { container } = render(
      <MediaModalViewer
        media={imageMedia}
        isOpen={false}
        onClose={() => {}}
        resolveThumbUrl={(img) => img.thumbUrl}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("navigates with ArrowRight and reports index changes", () => {
    const onChangeIndex = vi.fn();

    render(
      <MediaModalViewer
        media={imageMedia}
        isOpen
        initialIndex={0}
        onClose={() => {}}
        onChangeIndex={onChangeIndex}
        resolveThumbUrl={(img) => img.thumbUrl}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onChangeIndex).toHaveBeenCalledWith(1);
  });

  it("supports dot navigation", () => {
    const onChangeIndex = vi.fn();

    render(
      <MediaModalViewer
        media={imageMedia}
        isOpen
        initialIndex={0}
        onClose={() => {}}
        onChangeIndex={onChangeIndex}
        resolveThumbUrl={(img) => img.thumbUrl}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to image 2" }));

    expect(onChangeIndex).toHaveBeenCalledWith(1);
  });

  it("closes on Escape after close animation delay", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <MediaModalViewer
        media={imageMedia}
        isOpen
        onClose={onClose}
        resolveThumbUrl={(img) => img.thumbUrl}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("loads active video url only when video slide is active", async () => {
    const { container } = render(
      <MediaModalViewer
        media={videoMedia}
        isOpen
        onClose={() => {}}
        resolveVideoThumbUrl={(video) => video.thumbUrl}
      />,
    );

    await waitFor(() => {
      expect(getVideoDownloadUrlMock).toHaveBeenCalledWith("videos/full/clip-1.mp4");
    });

    await waitFor(() => {
      const videoEl = container.querySelector("video");
      expect(videoEl).not.toBeNull();
      expect(videoEl?.getAttribute("src")).toBe("https://video/clip-1.mp4");
    });
  });
});
