import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchEventsMock,
  fetchAllImageMetadataMock,
  fetchAllVideoMetadataMock,
  getVideoDownloadUrlMock,
  loadFromCacheMock,
  syncCacheMock,
  clearCacheMock,
  syncVideoThumbCacheMock,
  loadVideoThumbUrlsFromCacheMock,
  signInWithPasswordMock,
  signOutMock,
  authState,
} = vi.hoisted(() => ({
  fetchEventsMock: vi.fn(),
  fetchAllImageMetadataMock: vi.fn(),
  fetchAllVideoMetadataMock: vi.fn(),
  getVideoDownloadUrlMock: vi.fn(),
  loadFromCacheMock: vi.fn(),
  syncCacheMock: vi.fn(),
  clearCacheMock: vi.fn(),
  syncVideoThumbCacheMock: vi.fn(),
  loadVideoThumbUrlsFromCacheMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  authState: {
    user: { uid: "owner-1" } as { uid: string } | null,
  },
}));

vi.mock("../../services/authService", () => ({
  authService: {
    subscribeToAuthChanges: (cb: (user: { uid: string } | null) => void) => {
      cb(authState.user);
      return () => {};
    },
    signInWithPassword: signInWithPasswordMock,
    signOut: signOutMock,
  },
  signInWithPassword: signInWithPasswordMock,
}));

vi.mock("../../services/eventsService", () => ({
  fetchEvents: fetchEventsMock,
}));

vi.mock("../../services/storageService", () => ({
  fetchAllImageMetadata: fetchAllImageMetadataMock,
  fetchAllVideoMetadata: fetchAllVideoMetadataMock,
  getVideoDownloadUrl: getVideoDownloadUrlMock,
}));

vi.mock("../../services/mediaCacheService", () => ({
  loadFromCache: loadFromCacheMock,
  syncCache: syncCacheMock,
  clearCache: clearCacheMock,
  syncVideoThumbCache: syncVideoThumbCacheMock,
  loadVideoThumbUrlsFromCache: loadVideoThumbUrlsFromCacheMock,
}));

describe("App happy path", () => {
  beforeEach(() => {
    authState.user = { uid: "owner-1" };

    fetchEventsMock.mockReset().mockResolvedValue([
      {
        id: "event-1",
        date: "2024-07-04",
        title: "Summer Trip",
        imageIds: ["img-1.jpg"],
      },
    ]);

    fetchAllImageMetadataMock.mockReset().mockResolvedValue([
      {
        id: "img-1.jpg",
        storagePath: "images/full/img-1.jpg",
        date: "2024-07-04",
        event: "Summer Trip",
        caption: "At the beach",
        downloadUrl: "https://full/img-1.jpg",
        thumbUrl: "https://thumb/img-1.jpg",
      },
      {
        id: "img-2.jpg",
        storagePath: "images/full/img-2.jpg",
        date: "2024-06-12",
        event: "Summer Trip",
        caption: "Sunset",
        downloadUrl: "https://full/img-2.jpg",
        thumbUrl: "https://thumb/img-2.jpg",
      },
    ]);

    fetchAllVideoMetadataMock.mockReset().mockResolvedValue([
      {
        id: "clip-1.mp4",
        type: "video",
        date: "2024-07-05",
        event: "Summer Trip",
        caption: "Waves",
        videoPath: "videos/full/clip-1.mp4",
        thumbUrl: "https://thumb/clip-1.jpg",
        durationSeconds: 42,
      },
    ]);

    getVideoDownloadUrlMock.mockReset().mockResolvedValue("https://video/clip-1.mp4");

    loadFromCacheMock.mockReset().mockResolvedValue(null);
    syncCacheMock.mockReset().mockResolvedValue([]);
    clearCacheMock.mockReset().mockResolvedValue(undefined);
    syncVideoThumbCacheMock.mockReset().mockResolvedValue(undefined);
    loadVideoThumbUrlsFromCacheMock.mockReset().mockResolvedValue(new Map());
  });

  it("loads home and allows navigating core pages", async () => {
    window.history.replaceState({}, "", "/home");
    vi.resetModules();
    const { default: App } = await import("../../App");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /see all photos/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Photos" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/photos");
    });

    fireEvent.click(screen.getByRole("link", { name: "Videos" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/videos");
    });

    fireEvent.click(screen.getByRole("link", { name: "Timeline" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/timeline");
    });

    expect(fetchAllImageMetadataMock).toHaveBeenCalled();
    expect(fetchAllVideoMetadataMock).toHaveBeenCalled();
    expect(fetchEventsMock).toHaveBeenCalled();
  });
});
