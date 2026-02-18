import { beforeEach, describe, expect, it, vi } from "vitest";

const { collectionMock, getDocsMock, orderByMock, queryMock } = vi.hoisted(
  () => ({
    collectionMock: vi.fn(),
    getDocsMock: vi.fn(),
    orderByMock: vi.fn(),
    queryMock: vi.fn(),
  }),
);

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  getDocs: getDocsMock,
  orderBy: orderByMock,
  query: queryMock,
}));

vi.mock("../../services/firebaseFirestore", () => ({
  db: { mocked: true },
}));

import { fetchEvents } from "../../services/eventsService";

describe("eventsService", () => {
  beforeEach(() => {
    collectionMock.mockReset().mockImplementation((_db, name: string) => ({ name }));
    orderByMock
      .mockReset()
      .mockImplementation((field: string, direction: string) => ({
        field,
        direction,
      }));
    queryMock.mockReset().mockImplementation((...parts) => ({ parts }));
    getDocsMock.mockReset();
  });

  it("queries events ordered by date desc and maps defaults", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "e-1",
          data: () => ({
            date: "2024-01-01",
            title: "New Year",
            emojiOrDot: "🎉",
            imageIds: ["img-1.jpg"],
          }),
        },
        {
          id: "e-2",
          data: () => ({}),
        },
      ],
    });

    const events = await fetchEvents();

    expect(queryMock).toHaveBeenCalledWith(
      { name: "events" },
      { field: "date", direction: "desc" },
    );
    expect(events).toEqual([
      {
        id: "e-1",
        date: "2024-01-01",
        title: "New Year",
        emojiOrDot: "🎉",
        imageIds: ["img-1.jpg"],
      },
      {
        id: "e-2",
        date: "",
        title: "",
        emojiOrDot: undefined,
        imageIds: [],
      },
    ]);
  });

  it("maps permission-denied errors to actionable message", async () => {
    getDocsMock.mockRejectedValue({ code: "permission-denied" });

    await expect(fetchEvents()).rejects.toThrow(
      "Firestore rules denied events access",
    );
  });

  it("rethrows non-permission errors", async () => {
    getDocsMock.mockRejectedValue(new Error("network exploded"));

    await expect(fetchEvents()).rejects.toThrow("network exploded");
  });
});
