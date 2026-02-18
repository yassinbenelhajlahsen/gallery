import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  navigateMock,
  openModalWithImagesMock,
  resolveThumbUrlMock,
  requestFullResMock,
  resolveUrlMock,
  galleryState,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  openModalWithImagesMock: vi.fn(),
  resolveThumbUrlMock: vi.fn(),
  requestFullResMock: vi.fn(),
  resolveUrlMock: vi.fn(),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../context/GalleryContext", () => ({
  useGallery: () => ({
    imageMetas: galleryState.imageMetas,
    openModalWithImages: openModalWithImagesMock,
    resolveThumbUrl: resolveThumbUrlMock,
  }),
}));

vi.mock("../../hooks/usePageReveal", () => ({
  usePageReveal: () => true,
}));

vi.mock("../../hooks/useFullResLoader", () => ({
  useFullResLoader: () => ({
    resolveUrl: resolveUrlMock,
    requestFullRes: requestFullResMock,
  }),
}));

vi.mock("../../components/gallery/GalleryGrid", () => ({
  default: ({ tiles }: { tiles: Array<{ id: string; onClick?: () => void }> }) => (
    <div>
      {tiles.map((tile) => (
        <button key={tile.id} onClick={tile.onClick}>
          tile-{tile.id}
        </button>
      ))}
    </div>
  ),
}));

import HomePage from "../../pages/HomePage";

describe("HomePage", () => {
  beforeEach(() => {
    galleryState.imageMetas = [
      {
        id: "img-1.jpg",
        storagePath: "images/full/img-1.jpg",
        date: "2024-01-01",
        downloadUrl: "https://full/img-1.jpg",
        thumbUrl: "https://thumb/img-1.jpg",
        caption: "A",
      },
      {
        id: "img-2.jpg",
        storagePath: "images/full/img-2.jpg",
        date: "2024-01-02",
        downloadUrl: "https://full/img-2.jpg",
        thumbUrl: "https://thumb/img-2.jpg",
        caption: "B",
      },
    ];

    navigateMock.mockReset();
    openModalWithImagesMock.mockReset();
    requestFullResMock.mockReset();
    resolveThumbUrlMock.mockReset().mockImplementation((meta) => meta.thumbUrl);
    resolveUrlMock
      .mockReset()
      .mockImplementation((meta, fallback: string) => fallback || meta.downloadUrl);
  });

  it("requests full-res for selected tiles and opens modal from tile click", async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(requestFullResMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "tile-img-1.jpg" }));

    expect(openModalWithImagesMock).toHaveBeenCalledTimes(1);
    expect(openModalWithImagesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "img-1.jpg" }),
        expect.objectContaining({ id: "img-2.jpg" }),
      ]),
      expect.objectContaining({ initialIndex: 0 }),
    );
  });

  it("navigates to photos when CTA is clicked", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: /see all photos/i }));

    expect(navigateMock).toHaveBeenCalledWith("/photos", {
      state: { transition: "fade" },
    });
  });
});
