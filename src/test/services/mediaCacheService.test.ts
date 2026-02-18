import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageMeta } from "../../services/storageService";
import type { VideoMeta } from "../../types/mediaTypes";
import {
  clearCache,
  loadFromCache,
  loadVideoThumbUrlsFromCache,
  syncCache,
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

  constructor(private readonly store: Map<string, unknown>) {}

  private scheduleComplete() {
    if (this.completeScheduled) return;
    this.completeScheduled = true;
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }

  objectStore() {
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
      value: vi.fn(async (_url: string) => {
        return new Response(new Blob(["thumb"]), { status: 200 });
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

  it("clears image and video cache stores", async () => {
    const img = buildImageMeta("only.jpg", "2024-01-20");
    const vid = buildVideoMeta("only.mp4");

    await syncCache([img]);
    await syncVideoThumbCache([vid]);

    expect(await loadFromCache()).not.toBeNull();
    expect((await loadVideoThumbUrlsFromCache([vid])).size).toBe(1);

    await clearCache();

    expect(await loadFromCache()).toBeNull();
    expect((await loadVideoThumbUrlsFromCache([vid])).size).toBe(0);
  });
});
