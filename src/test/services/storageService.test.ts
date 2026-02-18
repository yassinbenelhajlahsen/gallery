import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  collectionMock,
  getDocsMock,
  getDownloadURLMock,
  refMock,
} = vi.hoisted(() => ({
  collectionMock: vi.fn(),
  getDocsMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
  refMock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  getDocs: getDocsMock,
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: getDownloadURLMock,
  ref: refMock,
}));

vi.mock("../../services/firebaseStorage", () => ({
  storage: { mocked: true },
}));

vi.mock("../../services/firebaseFirestore", () => ({
  db: { mocked: true },
}));

import {
  fetchAllImageMetadata,
  fetchAllVideoMetadata,
  getVideoDownloadUrl,
} from "../../services/storageService";

describe("storageService", () => {
  beforeEach(() => {
    collectionMock.mockReset().mockImplementation((_db, name) => ({ name }));
    getDocsMock.mockReset();
    getDownloadURLMock.mockReset();
    refMock.mockReset().mockImplementation((_storage, path: string) => ({ path }));
  });

  it("fetchAllImageMetadata sorts by newest date and falls back thumb URL", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "older.jpg",
          data: () => ({
            date: "2023-01-01",
            fullPath: "images/full/older.jpg",
            thumbPath: "images/thumb/older.jpg",
          }),
        },
        {
          id: "newer.jpg",
          data: () => ({
            date: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
            fullPath: "images/full/newer.jpg",
            thumbPath: "images/thumb/newer.jpg",
          }),
        },
      ],
    });

    getDownloadURLMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === "images/full/older.jpg") return "https://full/older";
      if (path === "images/full/newer.jpg") return "https://full/newer";
      if (path === "images/thumb/newer.jpg") return "https://thumb/newer";
      if (path === "images/thumb/older.jpg") throw new Error("missing thumb");
      throw new Error(`unexpected path ${path}`);
    });

    const result = await fetchAllImageMetadata();

    expect(result.map((item) => item.id)).toEqual(["newer.jpg", "older.jpg"]);
    expect(result[0]?.date).toBe("2024-01-01");
    expect(result[1]?.date).toBe("2023-01-01");
    expect(result[0]?.thumbUrl).toBe("https://thumb/newer");
    expect(result[1]?.thumbUrl).toBe("https://full/older");
  });

  it("normalizes ISO datetime strings to stable date-only values", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "iso.jpg",
          data: () => ({
            date: "2024-01-01T00:00:00.000Z",
            fullPath: "images/full/iso.jpg",
            thumbPath: "images/thumb/iso.jpg",
          }),
        },
      ],
    });

    getDownloadURLMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === "images/full/iso.jpg") return "https://full/iso";
      if (path === "images/thumb/iso.jpg") return "https://thumb/iso";
      throw new Error(`unexpected path ${path}`);
    });

    const result = await fetchAllImageMetadata();
    expect(result[0]?.date).toBe("2024-01-01");
  });

  it("fetchAllVideoMetadata filters unsupported ids and falls back to full video URL", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "clip.mp4",
          data: () => ({
            id: "clip.mp4",
            date: "2024-02-01",
            videoPath: "videos/full/clip.mp4",
            thumbPath: "videos/thumb/clip.jpg",
            durationSeconds: 125.4,
          }),
        },
        {
          id: "skip.webm",
          data: () => ({ id: "skip.webm", date: "2024-02-02" }),
        },
      ],
    });

    getDownloadURLMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === "videos/thumb/clip.jpg") throw new Error("no thumb");
      if (path === "videos/full/clip.mp4") return "https://video/clip";
      throw new Error(`unexpected path ${path}`);
    });

    const result = await fetchAllVideoMetadata();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("clip.mp4");
    expect(result[0]?.thumbUrl).toBe("https://video/clip");
    expect(result[0]?.durationSeconds).toBe(125);
  });

  it("maps permission-denied when fetching image metadata", async () => {
    getDocsMock.mockRejectedValue({ code: "permission-denied" });

    await expect(fetchAllImageMetadata()).rejects.toThrow(
      "Firestore rules denied images access",
    );
  });

  it("maps permission-denied when resolving a video URL", async () => {
    getDownloadURLMock.mockRejectedValue({ code: "permission-denied" });

    await expect(getVideoDownloadUrl("videos/full/a.mp4")).rejects.toThrow(
      "Storage rules denied video access",
    );
  });
});
