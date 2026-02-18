import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageMeta } from "../../../services/storageService";
import type { VideoMeta } from "../../../types/mediaTypes";
import type { TimelineEvent } from "../../../components/timeline/TimelineEventItem";

type GalleryState = {
  imageMetas: ImageMeta[];
  videoMetas: VideoMeta[];
  events: TimelineEvent[];
};

const {
  deleteObjectMock,
  refMock,
  collectionMock,
  queryMock,
  whereMock,
  getDocsMock,
  updateDocMock,
  arrayRemoveMock,
  deleteDocMock,
  docMock,
  getDocMock,
  writeBatchMock,
  toastMock,
  refreshGalleryMock,
  refreshEventsMock,
  galleryState,
} = vi.hoisted(() => ({
  deleteObjectMock: vi.fn(),
  refMock: vi.fn(),
  collectionMock: vi.fn(),
  queryMock: vi.fn(),
  whereMock: vi.fn(),
  getDocsMock: vi.fn(),
  updateDocMock: vi.fn(),
  arrayRemoveMock: vi.fn(),
  deleteDocMock: vi.fn(),
  docMock: vi.fn(),
  getDocMock: vi.fn(),
  writeBatchMock: vi.fn(),
  toastMock: vi.fn(),
  refreshGalleryMock: vi.fn(),
  refreshEventsMock: vi.fn(),
  galleryState: {
    imageMetas: [
      {
        id: "img-1.jpg",
        storagePath: "images/full/img-1.jpg",
        date: "2024-01-01",
        event: "Trip",
        caption: "Photo",
        downloadUrl: "https://full/img-1.jpg",
        thumbUrl: "https://thumb/img-1.jpg",
      },
    ],
    videoMetas: [],
    events: [],
  } as GalleryState,
}));

vi.mock("firebase/storage", () => ({
  deleteObject: deleteObjectMock,
  ref: refMock,
}));

vi.mock("firebase/firestore", () => ({
  arrayRemove: arrayRemoveMock,
  collection: collectionMock,
  deleteDoc: deleteDocMock,
  doc: docMock,
  getDoc: getDocMock,
  getDocs: getDocsMock,
  query: queryMock,
  updateDoc: updateDocMock,
  where: whereMock,
  writeBatch: writeBatchMock,
}));

vi.mock("../../../services/firebaseStorage", () => ({
  storage: { mocked: true },
}));

vi.mock("../../../services/firebaseFirestore", () => ({
  db: { mocked: true },
}));

vi.mock("../../../context/ToastContext", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("../../../context/GalleryContext", () => ({
  useGallery: () => ({
    imageMetas: galleryState.imageMetas,
    videoMetas: galleryState.videoMetas,
    events: galleryState.events,
    refreshGallery: refreshGalleryMock,
    refreshEvents: refreshEventsMock,
    resolveThumbUrl: (meta: { thumbUrl: string }) => meta.thumbUrl,
    resolveVideoThumbUrl: () => "",
  }),
}));

import DeleteTab from "../../../components/admin/DeleteTab";

describe("DeleteTab", () => {
  beforeEach(() => {
    galleryState.imageMetas = [
      {
        id: "img-1.jpg",
        storagePath: "images/full/img-1.jpg",
        date: "2024-01-01",
        event: "Trip",
        caption: "Photo",
        downloadUrl: "https://full/img-1.jpg",
        thumbUrl: "https://thumb/img-1.jpg",
      },
    ];
    galleryState.videoMetas = [];
    galleryState.events = [];

    deleteObjectMock.mockReset().mockResolvedValue(undefined);
    refMock
      .mockReset()
      .mockImplementation((_storage, path: string) => ({ path }));
    collectionMock.mockReset().mockImplementation((_db, name) => ({ name }));
    whereMock.mockReset().mockReturnValue({});
    queryMock.mockReset().mockReturnValue({});
    getDocsMock.mockReset().mockResolvedValue({ docs: [{ ref: "event-ref" }] });
    updateDocMock.mockReset().mockResolvedValue(undefined);
    arrayRemoveMock.mockReset().mockImplementation((value: string) => value);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
    docMock
      .mockReset()
      .mockImplementation((_db, collectionName: string, id: string) => ({
        collectionName,
        id,
      }));
    getDocMock.mockReset().mockResolvedValue({ exists: () => false });
    writeBatchMock.mockReset().mockReturnValue({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
    toastMock.mockReset();
    refreshGalleryMock.mockReset().mockResolvedValue(undefined);
    refreshEventsMock.mockReset().mockResolvedValue(undefined);
  });

  it("deletes image storage objects + metadata after two-step confirm", async () => {
    render(<DeleteTab />);

    const deleteButton = screen.getByRole("button", { name: "Delete" });

    fireEvent.click(deleteButton);
    expect(
      screen.getByRole("button", { name: "Confirm Delete" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    });

    expect(deleteObjectMock).toHaveBeenCalledWith({
      path: "images/full/img-1.jpg",
    });
    expect(deleteObjectMock).toHaveBeenCalledWith({
      path: "images/thumb/img-1.jpg",
    });
    expect(deleteDocMock).toHaveBeenCalledWith({
      collectionName: "images",
      id: "img-1.jpg",
    });
    expect(updateDocMock).toHaveBeenCalledWith("event-ref", {
      imageIds: "img-1.jpg",
    });
    expect(refreshGalleryMock).toHaveBeenCalledTimes(1);
    expect(refreshEventsMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      "Deleted image img-1.jpg",
      "success",
    );
  });

  it("filters delete lists by keystroke for event name, file name, and date", () => {
    galleryState.imageMetas = [
      {
        id: "beach.jpg",
        storagePath: "images/full/beach.jpg",
        date: "2024-07-04",
        event: "Summer Trip",
        caption: "Beach day",
        downloadUrl: "https://full/beach.jpg",
        thumbUrl: "https://thumb/beach.jpg",
      },
      {
        id: "family.jpg",
        storagePath: "images/full/family.jpg",
        date: "2023-12-25",
        event: "Christmas",
        caption: "Family",
        downloadUrl: "https://full/family.jpg",
        thumbUrl: "https://thumb/family.jpg",
      },
    ];

    render(<DeleteTab />);

    const searchInput = screen.getByLabelText("Search media and events");

    fireEvent.change(searchInput, { target: { value: "summer" } });
    expect(screen.getByText("beach.jpg")).toBeInTheDocument();
    expect(screen.queryByText("family.jpg")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "family.jpg" } });
    expect(screen.getByText("family.jpg")).toBeInTheDocument();
    expect(screen.queryByText("beach.jpg")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "2024-07-04" } });
    expect(screen.getByText("beach.jpg")).toBeInTheDocument();
    expect(screen.queryByText("family.jpg")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "no-match" } });
    expect(screen.getByText("No images match your search.")).toBeInTheDocument();
  });

  it("tolerates storage/object-not-found errors during media delete", async () => {
    galleryState.imageMetas = [];
    galleryState.videoMetas = [
      {
        id: "clip-1.mp4",
        type: "video",
        date: "2024-04-01",
        videoPath: "videos/full/clip-1.mp4",
        thumbUrl: "https://thumb/clip-1.jpg",
      },
    ];

    deleteObjectMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === "videos/thumb/clip-1.jpg") {
        throw { code: "storage/object-not-found" };
      }
      return undefined;
    });

    render(<DeleteTab />);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(deleteDocMock).toHaveBeenCalledWith({
        collectionName: "videos",
        id: "clip-1.mp4",
      });
    });
    expect(toastMock).toHaveBeenCalledWith("Deleted video clip-1.mp4", "success");
  });

  it("deletes timeline events and clears linked media event fields", async () => {
    const batchUpdateMock = vi.fn();
    const batchCommitMock = vi.fn().mockResolvedValue(undefined);
    writeBatchMock.mockReturnValue({
      update: batchUpdateMock,
      commit: batchCommitMock,
    });

    galleryState.imageMetas = [];
    galleryState.videoMetas = [];
    galleryState.events = [
      {
        id: "event-1",
        date: "2024-03-10",
        title: "Trip",
        imageIds: ["img-1.jpg", "vid-1.mp4"],
      },
    ];

    queryMock.mockImplementation((collectionRef: { name: string }) => ({
      collectionName: collectionRef.name,
    }));

    getDocsMock.mockImplementation(async (queryRef: { collectionName: string }) => {
      if (queryRef.collectionName === "images") {
        return { docs: [{ id: "img-by-event" }] };
      }
      if (queryRef.collectionName === "videos") {
        return { docs: [{ id: "vid-by-event" }] };
      }
      return { docs: [] };
    });

    getDocMock.mockImplementation(async (docRef: { collectionName: string; id: string }) => {
      if (docRef.collectionName === "images" && docRef.id === "img-1.jpg") {
        return { exists: () => true };
      }
      if (docRef.collectionName === "videos" && docRef.id === "vid-1.mp4") {
        return { exists: () => true };
      }
      return { exists: () => false };
    });

    render(<DeleteTab />);

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(deleteDocMock).toHaveBeenCalledWith({
        collectionName: "events",
        id: "event-1",
      });
    });

    expect(batchUpdateMock).toHaveBeenCalledWith(
      { collectionName: "images", id: "img-1.jpg" },
      { event: null },
    );
    expect(batchUpdateMock).toHaveBeenCalledWith(
      { collectionName: "videos", id: "vid-1.mp4" },
      { event: null },
    );
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith("Deleted timeline event", "success");
  });
});
