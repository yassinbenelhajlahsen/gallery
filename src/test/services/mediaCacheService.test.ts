import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageMeta } from "../../services/storageService";
import type { VideoMeta } from "../../types/mediaTypes";
import {
  clearCache,
  loadFromCache,
  loadFullResUrlsFromCache,
  loadVideoThumbUrlsFromCache,
  syncCache,
  syncFullResCache,
  syncVideoThumbCache,
} from "../../services/mediaCacheService";

type RequestStub<T = unknown> = {
  result?: T;
  error?: unknown;
  onsuccess: null | ((event: { target: RequestStub<T> }) => void);
  onerror: null | ((event: { target: RequestStub<T> }) => void);
};

const makeRequest = <T,>(run: () => T): RequestStub<T> => {
  const request: RequestStub<T> = {
    onsuccess: null,
    onerror: null,
  };

  setTimeout(() => {
    try {
      request.result = run();
      request.onsuccess?.({ target: request });
    } catch (error) {
      request.error = error;
      request.onerror?.({ target: request });
    }
  }, 0);

  return request;
};

class FakeTransaction {
  public oncomplete: null | (() => void) = null;
  public onerror: null | (() => void) = null;
  private completeScheduled = false;

  private readonly store: Map<string, unknown>;

  constructor(store: Map<string, unknown>) {
    this.store = store;
  }

  private scheduleComplete() {
    if (this.completeScheduled) return;
    this.completeScheduled = true;
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }

  objectStore() {
    const store = this.store;
    return {
      get: (key: string) => makeRequest(() => this.store.get(key)),
      getAllKeys: () => makeRequest(() => Array.from(this.store.keys())),
      put: (value: unknown, key: string) =>
        makeRequest(() => {
          this.store.set(key, value);
          this.scheduleComplete();
          return key;
        }),
      delete: (key: string) =>
        makeRequest(() => {
          this.store.delete(key);
          this.scheduleComplete();
          return undefined;
        }),
      clear: () =>
        makeRequest(() => {
          this.store.clear();
          this.scheduleComplete();
          return undefined;
        }),
      openCursor: () => {
        const entries = Array.from(store.entries());
        const request: {
          result: { key: string; value: unknown; continue: () => void } | null;
          onsuccess: null | (() => void);
          onerror: null | (() => void);
        } = { result: null, onsuccess: null, onerror: null };

        let i = 0;
        const advance = () => {
          if (i >= entries.length) {
            request.result = null;
            setTimeout(() => request.onsuccess?.(), 0);
            return;
          }
          const [key, value] = entries[i++];
          request.result = { key, value, continue: advance };
          setTimeout(() => request.onsuccess?.(), 0);
        };
        advance();
        return request;
      },
    };
  }
}

class FakeDB {
  private readonly stores = new Map<string, Map<string, unknown>>();

  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  createObjectStore(name: string) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return {};
  }

  transaction(storeName: string) {
    const store = this.stores.get(storeName);
    if (!store) {
      throw new Error(`Missing store ${storeName}`);
    }
    return new FakeTransaction(store);
  }

  close() {
    // no-op
  }
}

class FakeIndexedDBFactory {
  private readonly dbByName = new Map<string, FakeDB>();

  open(name: string) {
    const request: {
      result?: FakeDB;
      error?: unknown;
      onupgradeneeded: null | (() => void);
      onsuccess: null | (() => void);
      onerror: null | (() => void);
    } = {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };

    setTimeout(() => {
      try {
        let db = this.dbByName.get(name);
        const isNew = !db;
        if (!db) {
          db = new FakeDB();
          this.dbByName.set(name, db);
        }
        request.result = db;
        if (isNew) {
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      } catch (error) {
        request.error = error;
        request.onerror?.();
      }
    }, 0);

    return request;
  }
}

const buildImageMeta = (id: string, date: string): ImageMeta => ({
  id,
  storagePath: `images/full/${id}`,
  date,
  downloadUrl: `https://full/${id}`,
  thumbUrl: `https://thumb/${id}`,
});

const buildVideoMeta = (id: string): VideoMeta => ({
  id,
  type: "video",
  date: "2024-01-01",
  videoPath: `videos/full/${id}`,
  thumbUrl: `https://thumb/${id.replace(/\.[^.]+$/, ".jpg")}`,
});

describe("mediaCacheService", () => {
  beforeEach(() => {
    const fakeIndexedDb = new FakeIndexedDBFactory();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: fakeIndexedDb,
    });

    let objectUrlCounter = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:cache-${++objectUrlCounter}`),
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: vi.fn(async () => {
        return new Response("thumb", { status: 200 });
      }),
    });
  });

  it("syncs image cache with progress updates and removes stale entries", async () => {
    const metasA = [
      buildImageMeta("a.jpg", "2024-03-01"),
      buildImageMeta("b.jpg", "2024-02-01"),
    ];

    const progressA: Array<[number, number]> = [];
    await syncCache(metasA, (loaded, total) => progressA.push([loaded, total]));

    expect(progressA).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);

    const metasB = [
      buildImageMeta("b.jpg", "2024-02-01"),
      buildImageMeta("c.jpg", "2024-04-01"),
    ];

    const progressB: Array<[number, number]> = [];
    await syncCache(metasB, (loaded, total) => progressB.push([loaded, total]));

    expect(progressB).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);

    const cached = await loadFromCache();
    expect(cached?.metas.map((m) => m.id)).toEqual(["b.jpg", "c.jpg"]);
    expect(cached?.preloaded.map((p) => p.meta.id).sort()).toEqual([
      "b.jpg",
      "c.jpg",
    ]);
  });

  it("caches video thumbs with namespaced keys and evicts removed ids", async () => {
    const v1 = buildVideoMeta("clip-1.mp4");
    const v2 = buildVideoMeta("clip-2.mov");

    await syncVideoThumbCache([v1, v2]);

    expect(fetch).toHaveBeenCalledWith(v1.thumbUrl, { mode: "cors" });
    expect(fetch).toHaveBeenCalledWith(v2.thumbUrl, { mode: "cors" });

    const initialMap = await loadVideoThumbUrlsFromCache([v1, v2]);
    expect(initialMap.has(v1.id)).toBe(true);
    expect(initialMap.has(v2.id)).toBe(true);

    await syncVideoThumbCache([v2]);
    const nextMap = await loadVideoThumbUrlsFromCache([v1, v2]);

    expect(nextMap.has(v1.id)).toBe(false);
    expect(nextMap.has(v2.id)).toBe(true);
  });

  it("clears image, video, and full-res cache stores", async () => {
    const img = buildImageMeta("only.jpg", "2024-01-20");
    const vid = buildVideoMeta("only.mp4");

    await syncCache([img]);
    await syncVideoThumbCache([vid]);
    await syncFullResCache([img]);

    expect(await loadFromCache()).not.toBeNull();
    expect((await loadVideoThumbUrlsFromCache([vid])).size).toBe(1);
    expect((await loadFullResUrlsFromCache([img])).size).toBe(1);

    await clearCache();

    expect(await loadFromCache()).toBeNull();
    expect((await loadVideoThumbUrlsFromCache([vid])).size).toBe(0);
    expect((await loadFullResUrlsFromCache([img])).size).toBe(0);
  });

  describe("full-res cache", () => {
    // Use a small blob body so we can control cache budgeting precisely.
    // Each image is 100 bytes; with a 250-byte budget, only the 2 newest fit.
    const body = "x".repeat(100);

    beforeEach(() => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        async () => new Response(body, { status: 200 }),
      );
    });

    it("keeps only the newest images that fit within the budget", async () => {
      const metas = [
        buildImageMeta("old.jpg", "2024-01-01"),
        buildImageMeta("mid.jpg", "2024-06-01"),
        buildImageMeta("new.jpg", "2024-12-01"),
      ];

      const progress: Array<[number, number]> = [];
      await syncFullResCache(metas, {
        budgetBytes: 250,
        onProgress: (loaded, total) => progress.push([loaded, total]),
      });

      const urls = await loadFullResUrlsFromCache(metas);
      expect(urls.has("new.jpg")).toBe(true);
      expect(urls.has("mid.jpg")).toBe(true);
      expect(urls.has("old.jpg")).toBe(false);

      expect(progress.at(-1)?.[1]).toBe(3);
      // newest-first fetch order
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe("https://full/new.jpg");
      expect(calls[1][0]).toBe("https://full/mid.jpg");
    });

    it("evicts the oldest cached image when a new upload overflows the budget", async () => {
      const initial = [
        buildImageMeta("a.jpg", "2024-01-01"),
        buildImageMeta("b.jpg", "2024-02-01"),
      ];
      await syncFullResCache(initial, { budgetBytes: 250 });
      expect((await loadFullResUrlsFromCache(initial)).size).toBe(2);

      const afterUpload = [
        ...initial,
        buildImageMeta("c.jpg", "2024-03-01"),
      ];
      await syncFullResCache(afterUpload, { budgetBytes: 250 });

      const urls = await loadFullResUrlsFromCache(afterUpload);
      expect(urls.has("c.jpg")).toBe(true);
      expect(urls.has("b.jpg")).toBe(true);
      expect(urls.has("a.jpg")).toBe(false);
    });

    it("evicts cached entries whose ids no longer appear in freshMetas", async () => {
      const initial = [
        buildImageMeta("a.jpg", "2024-01-01"),
        buildImageMeta("b.jpg", "2024-02-01"),
      ];
      await syncFullResCache(initial, { budgetBytes: 10_000 });
      expect((await loadFullResUrlsFromCache(initial)).size).toBe(2);

      // `b.jpg` deleted upstream
      await syncFullResCache([initial[0]], { budgetBytes: 10_000 });
      const urls = await loadFullResUrlsFromCache(initial);
      expect(urls.has("a.jpg")).toBe(true);
      expect(urls.has("b.jpg")).toBe(false);
    });

    it("does not re-fetch already cached images on subsequent syncs", async () => {
      const metas = [
        buildImageMeta("a.jpg", "2024-01-01"),
        buildImageMeta("b.jpg", "2024-02-01"),
      ];
      await syncFullResCache(metas, { budgetBytes: 10_000 });
      const fetchCount1 = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls.length;

      await syncFullResCache(metas, { budgetBytes: 10_000 });
      const fetchCount2 = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls.length;

      expect(fetchCount2).toBe(fetchCount1);
    });
  });
});
