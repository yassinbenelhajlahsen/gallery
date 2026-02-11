import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    refreshGallery: refreshGalleryMock,
    refreshEvents: refreshEventsMock,
    resolveThumbUrl: (meta: { thumbUrl: string }) => meta.thumbUrl,
    resolveVideoThumbUrl: () => "",
  }),
}));

import AdminDeleteTab from "../../../components/admin/AdminDeleteTab";

describe("AdminDeleteTab", () => {
  beforeEach(() => {
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
    render(<AdminDeleteTab />);

    const deleteButton = screen.getByRole("button", { name: "Delete" });

    fireEvent.click(deleteButton);
    expect(screen.getByRole("button", { name: "Confirm Delete" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    });

    expect(deleteObjectMock).toHaveBeenCalledWith({ path: "images/full/img-1.jpg" });
    expect(deleteObjectMock).toHaveBeenCalledWith({ path: "images/thumb/img-1.jpg" });
    expect(deleteDocMock).toHaveBeenCalledWith({
      collectionName: "images",
      id: "img-1.jpg",
    });
    expect(updateDocMock).toHaveBeenCalledWith("event-ref", {
      imageIds: "img-1.jpg",
    });
    expect(refreshGalleryMock).toHaveBeenCalledTimes(1);
    expect(refreshEventsMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith("Deleted image img-1.jpg", "success");
  });
});
