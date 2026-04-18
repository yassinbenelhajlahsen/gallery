import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  addDocMock,
  collectionMock,
  setDocMock,
  docMock,
  getDocMock,
  serverTimestampMock,
  refMock,
  uploadBytesResumableMock,
  getDownloadURLMock,
  getMetadataMock,
  deleteObjectMock,
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
  uploadBytesResumableMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
  getMetadataMock: vi.fn(),
  deleteObjectMock: vi.fn(),
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
  uploadBytesResumable: uploadBytesResumableMock,
  getDownloadURL: getDownloadURLMock,
  getMetadata: getMetadataMock,
  deleteObject: deleteObjectMock,
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
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
    uploadBytesResumableMock.mockReset().mockImplementation(() => ({
      cancel: vi.fn(),
      on: (
        _event: string,
        _onNext: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
        _onError: (err: unknown) => void,
        onComplete: () => void,
      ) => {
        queueMicrotask(() => onComplete());
      },
    }));
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
    deleteObjectMock.mockReset().mockResolvedValue(undefined);

    toastMock.mockReset();
    refreshEventsMock.mockReset().mockResolvedValue(undefined);
    refreshGalleryMock.mockReset().mockResolvedValue(undefined);
    inferUploadDateFromMetadataMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("creates a timeline event and refreshes events", async () => {
    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[1], { target: { value: "2024-08-01" } });

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

  it("shows error toast when event creation fails", async () => {
    addDocMock.mockRejectedValueOnce(new Error("firestore down"));
    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[1], { target: { value: "2024-10-01" } });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: "Broken Event" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        "Failed to create event. Please try again.",
        "error",
      );
    });
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
    expect(dateInputs[0]?.value).toBe("2024-07-04");
    expect((screen.getByLabelText(/^Label$/i) as HTMLInputElement).value).toBe(
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
    await waitFor(() => {
      expect(dateInputs[0]?.value).toBe("2025-01-02");
    });
  });

  it("pre-uploads bytes when files are added, then commits Firestore doc on Upload click", async () => {
    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[0], { target: { value: "2024-09-15" } });

    fireEvent.change(screen.getByLabelText(/^Label$/i), {
      target: { value: "Trip" },
    });

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Bytes should be staged before the user even clicks Upload.
    await waitFor(() => {
      expect(uploadBytesResumableMock).toHaveBeenCalledWith(
        { path: "images/full/beach.jpg" },
        expect.any(Blob),
        { contentType: "image/jpeg" },
      );
    });
    expect(uploadBytesResumableMock).toHaveBeenCalledWith(
      { path: "images/thumb/beach.jpg" },
      expect.any(Blob),
      { contentType: "image/jpeg" },
    );
    // No Firestore write yet — staging only uploads bytes.
    expect(setDocMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Media" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Upload Media" }));

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalledTimes(1);
    });

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
    fireEvent.change(dateInputs[0], { target: { value: "2024-09-16" } });

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Media" })).not.toBeDisabled();
    });

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

  it("shows fatal upload error when every file fails the commit write", async () => {
    setDocMock.mockRejectedValueOnce(new Error("firestore write failed"));
    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[0], { target: { value: "2024-09-20" } });

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Media" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Upload Media" }));

    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });
    expect(screen.getByText("No files were successfully uploaded")).toBeInTheDocument();
    expect(refreshGalleryMock).not.toHaveBeenCalled();
  });

  it("discards staged Storage blobs when the user removes a file before clicking Upload", async () => {
    render(<UploadTab />);

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the staged byte transfer to start (full + thumb both kicked off).
    await waitFor(() => {
      expect(uploadBytesResumableMock).toHaveBeenCalledTimes(2);
    });

    deleteObjectMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));

    await waitFor(() => {
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    });
    expect(deleteObjectMock).toHaveBeenCalledWith({ path: "images/full/beach.jpg" });
    expect(deleteObjectMock).toHaveBeenCalledWith({ path: "images/thumb/beach.jpg" });
    // No Firestore commit happened, so removing must not have published anything.
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("surfaces stage errors in the Upload Progress panel after Upload click", async () => {
    uploadBytesResumableMock.mockImplementation(() => ({
      cancel: vi.fn(),
      on: (
        _event: string,
        _onNext: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
        onError: (err: unknown) => void,
      ) => {
        queueMicrotask(() => onError(new Error("network blip")));
      },
    }));

    render(<UploadTab />);

    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[0], { target: { value: "2024-09-15" } });

    const fileInput = getFileInput();
    const file = new File(["image-bytes"], "beach.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Media" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Upload Media" }));

    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });
    expect(screen.getByText("No files were successfully uploaded")).toBeInTheDocument();
    expect(setDocMock).not.toHaveBeenCalled();
    expect(refreshGalleryMock).not.toHaveBeenCalled();
  });
});
