import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const {
  addDocMock,
  collectionMock,
  setDocMock,
  docMock,
  getDocMock,
  serverTimestampMock,
  refMock,
  uploadBytesMock,
  getDownloadURLMock,
  getMetadataMock,
  toastMock,
  refreshEventsMock,
  refreshGalleryMock,
  inferUploadDateFromMetadataMock,
  galleryState,
} = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  collectionMock: vi.fn(),
  setDocMock: vi.fn(),
  docMock: vi.fn(),
  getDocMock: vi.fn(),
  serverTimestampMock: vi.fn(),
  refMock: vi.fn(),
  uploadBytesMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
  getMetadataMock: vi.fn(),
  toastMock: vi.fn(),
  refreshEventsMock: vi.fn(),
  refreshGalleryMock: vi.fn(),
  inferUploadDateFromMetadataMock: vi.fn(),
  galleryState: {
    events: [
      {
        id: "event-1",
        title: "Beach Trip",
        date: "2024-07-04",
        imageIds: [],
      },
    ],
  },
}));

vi.mock("firebase/firestore", () => ({
  addDoc: addDocMock,
  collection: collectionMock,
  setDoc: setDocMock,
  doc: docMock,
  getDoc: getDocMock,
  serverTimestamp: serverTimestampMock,
}));

vi.mock("firebase/storage", () => ({
  ref: refMock,
  uploadBytes: uploadBytesMock,
  getDownloadURL: getDownloadURLMock,
  getMetadata: getMetadataMock,
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
    events: galleryState.events,
    refreshEvents: refreshEventsMock,
    refreshGallery: refreshGalleryMock,
  }),
}));

vi.mock("../../../utils/uploadDateMetadata", () => ({
  inferUploadDateFromMetadata: inferUploadDateFromMetadataMock,
}));

import UploadTab from "../../../components/admin/UploadTab";

const originalImage = globalThis.Image;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

class MockImage {
  public onload: null | (() => void) = null;
  public onerror: null | (() => void) = null;
  public onabort: null | (() => void) = null;
  public crossOrigin = "";
  public width = 120;
  public height = 80;
  public naturalWidth = 120;
  public complete = true;

  set src(_value: string) {
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

const getDateInputs = () =>
  Array.from(
    document.querySelectorAll("input[type='date']"),
  ) as HTMLInputElement[];

const getFileInput = () =>
  document.querySelector("input[type='file']") as HTMLInputElement;

const getEventSelect = () =>
  document.querySelector("select") as HTMLSelectElement;

beforeAll(() => {
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: MockImage,
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ drawImage: vi.fn() })),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    writable: true,
    value: vi.fn((cb: BlobCallback) => {
      cb(new Blob(["jpeg"], { type: "image/jpeg" }));
    }),
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: originalImage,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: originalRevokeObjectURL,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: originalGetContext,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    writable: true,
    value: originalToBlob,
  });
});

describe("UploadTab", () => {
  beforeEach(() => {
    galleryState.events = [
      {
        id: "event-1",
        title: "Beach Trip",
        date: "2024-07-04",
        imageIds: [],
      },
    ];

    addDocMock.mockReset().mockResolvedValue({ id: "new-event" });
    collectionMock.mockReset().mockImplementation((_db, name: string) => ({ name }));
    setDocMock.mockReset().mockResolvedValue(undefined);
    docMock
      .mockReset()
      .mockImplementation((_db, collectionName: string, id: string) => ({
        collectionName,
        id,
      }));
    getDocMock.mockReset().mockResolvedValue({ exists: () => false });
    serverTimestampMock.mockReset().mockReturnValue("SERVER_TS");

    refMock.mockReset().mockImplementation((_storage, path: string) => ({ path }));
    uploadBytesMock.mockReset().mockResolvedValue(undefined);
    getDownloadURLMock
      .mockReset()
      .mockImplementation(async ({ path }: { path: string }) => {
        if (path.startsWith("images/full/")) return `https://full/${path}`;
        if (path.startsWith("images/thumb/")) return `https://thumb/${path}`;
        if (path.startsWith("videos/thumb/")) return `https://thumb/${path}`;
        return `https://download/${path}`;
      });
    getMetadataMock
      .mockReset()
      .mockRejectedValue({ code: "storage/object-not-found" });

    toastMock.mockReset();
    refreshEventsMock.mockReset().mockResolvedValue(undefined);
    refreshGalleryMock.mockReset().mockResolvedValue(undefined);
    inferUploadDateFromMetadataMock.mockReset().mockResolvedValue(null);
  });

  it("creates a timeline event and refreshes events", async () => {
    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[0], { target: { value: "2024-08-01" } });

    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Anniversary" },
    });
    fireEvent.change(screen.getByLabelText(/Emoji/i), {
      target: { value: "🎉" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => {
      expect(addDocMock).toHaveBeenCalledTimes(1);
    });

    expect(addDocMock).toHaveBeenCalledWith(
      { name: "events" },
      expect.objectContaining({
        date: "2024-08-01",
        title: "Anniversary",
        imageIds: [],
        emojiOrDot: "🎉",
        createdAt: "SERVER_TS",
      }),
    );
    expect(refreshEventsMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith("Event created successfully!", "success");
  });

  it("does not infer metadata date when an event is selected", async () => {
    render(<UploadTab />);

    fireEvent.change(getEventSelect(), {
      target: { value: "event-1" },
    });

    const fileInput = getFileInput();
    const file = new File(["x"], "beach.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(inferUploadDateFromMetadataMock).not.toHaveBeenCalled();
    });

    const dateInputs = getDateInputs();
    expect(dateInputs[1]?.value).toBe("2024-07-04");
    expect((screen.getByLabelText(/Event Name/i) as HTMLInputElement).value).toBe(
      "Beach Trip",
    );
  });

  it("infers date from selected media when no event is selected", async () => {
    inferUploadDateFromMetadataMock.mockResolvedValueOnce("2025-01-02");
    render(<UploadTab />);

    const fileInput = getFileInput();
    const file = new File(["x"], "memory.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(inferUploadDateFromMetadataMock).toHaveBeenCalledTimes(1);
    });

    const dateInputs = getDateInputs();
    expect(dateInputs[1]?.value).toBe("2025-01-02");
  });

  it("uploads an image, writes Firestore metadata, and refreshes gallery", async () => {
    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[1], { target: { value: "2024-09-15" } });

    fireEvent.change(screen.getByLabelText(/Event Name/i), {
      target: { value: "Trip" },
    });

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Upload Media" }));

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalledTimes(1);
    });

    expect(uploadBytesMock).toHaveBeenCalledWith(
      { path: "images/full/beach.jpg" },
      expect.any(Blob),
      { contentType: "image/jpeg" },
    );
    expect(uploadBytesMock).toHaveBeenCalledWith(
      { path: "images/thumb/beach.jpg" },
      expect.any(Blob),
      { contentType: "image/jpeg" },
    );

    expect(setDocMock).toHaveBeenCalledWith(
      { collectionName: "images", id: "beach.jpg" },
      expect.objectContaining({
        id: "beach.jpg",
        type: "image",
        date: "2024-09-15",
        fullPath: "images/full/beach.jpg",
        thumbPath: "images/thumb/beach.jpg",
        event: "Trip",
        createdAt: "SERVER_TS",
      }),
      { merge: true },
    );

    await waitFor(() => {
      expect(refreshGalleryMock).toHaveBeenCalledTimes(1);
    });

    expect(toastMock).toHaveBeenCalledWith(
      "1 upload completed successfully!",
      "success",
    );
  });

  it("resolves duplicate image names by incrementing suffix", async () => {
    getDocMock.mockImplementation(async (docRef: { id: string }) => {
      return { exists: () => docRef.id === "beach.jpg" };
    });

    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[1], { target: { value: "2024-09-16" } });

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Upload Media" }));

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalledTimes(1);
    });

    expect(setDocMock).toHaveBeenCalledWith(
      { collectionName: "images", id: "beach-1.jpg" },
      expect.objectContaining({ id: "beach-1.jpg" }),
      { merge: true },
    );
  });
});
