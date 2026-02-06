# Data Flow & State Management

> How image data moves from Firebase through caching layers to the UI, and how the modal/auth state machines work.

## Data Lifecycle Overview

```
Firebase Storage
    │
    ▼
storageService.fetchAllImageMetadata()    ← Fetches metadata + URLs for all images
    │
    ▼
GalleryContext (GalleryProvider)           ← Central state owner
    │
    ├──► imageCacheService (IndexedDB)     ← Caches thumbnail blobs for instant restore
    │
    ├──► imageMetas[]                      ← Metadata array available to all pages
    ├──► preloadedImages[]                 ← Thumbnail blob URLs for grid rendering
    ├──► resolveThumbUrl(meta)             ← Best-effort thumbnail resolution
    │
    └──► Modal state (isModalOpen, modalImages, etc.)
              │
              ▼
         GalleryModalRenderer → ImageModalViewer
              │
              └──► Full-res on-demand loading (windowed ±N or preloadAll)
```

## Service Layer

### `storageService.ts`

**Single responsibility:** Talk to Firebase Storage. Returns typed `ImageMeta[]`.

```typescript
type ImageMeta = {
  id: string; // filename (e.g. "photo1.jpg")
  storagePath: string; // "images/full/photo1.jpg"
  date: string; // ISO string, normalized
  event?: string; // custom metadata
  caption?: string; // custom metadata
  downloadUrl: string; // full-res download URL (signed)
  thumbUrl: string; // thumbnail download URL (falls back to downloadUrl)
};
```

**`fetchAllImageMetadata()`** does:

1. `listAll(ref(storage, "images/full"))` to discover all files
2. For each file, fetches metadata + full download URL + thumb download URL in parallel
3. Normalizes `date` from custom metadata (falls back to `timeCreated`)
4. Returns sorted **newest-first** by date

**Key details:**

- Metadata normalization handles both `date`/`Date`, `event`/`Event`, `caption`/`Caption` keys (case-insensitive custom metadata)
- If a thumbnail doesn't exist in `images/thumb/`, falls back to the full-res URL
- Date parsing is defensive — returns `new Date().toISOString()` if unparseable

### `authService.ts`

Thin wrapper around Firebase Auth. Hardcodes the login email from `config.authEmail`.

| Method                       | What it does                                         |
| ---------------------------- | ---------------------------------------------------- |
| `signInWithPassword(pw)`     | `signInWithEmailAndPassword(auth, EMAIL, pw)`        |
| `signOut()`                  | `signOut(auth)`                                      |
| `subscribeToAuthChanges(cb)` | `onAuthStateChanged(auth, cb)` — returns unsubscribe |

**Rule:** Never call Firebase Auth directly. Use `useAuth()` hook which wraps `authService`.

### `imageCacheService.ts`

IndexedDB-backed thumbnail cache with two object stores:

| Store         | Key            | Value                     |
| ------------- | -------------- | ------------------------- |
| `image-blobs` | `ImageMeta.id` | `Blob` (thumbnail JPEG)   |
| `meta`        | `"manifest"`   | `ImageMeta[]` (full list) |

**Public API:**

| Function                        | Purpose                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `loadFromCache()`               | Returns `{ metas, preloaded }` or `null` if no cache                          |
| `syncCache(fresh, onProgress?)` | Diffs fresh vs cached, downloads new thumbs, evicts removed, updates manifest |
| `clearCache()`                  | Wipes both stores (called on logout)                                          |

**`syncCache` algorithm:**

1. Read all cached blob keys from IndexedDB
2. Compute diff: `toDownload` = IDs in fresh but not cached, `toRemove` = cached but not in fresh
3. Evict removed blobs
4. Download new thumbnails in batches of 60 (parallel within batch)
5. Build full `PreloadedImage[]` from cache + new downloads
6. Persist updated manifest
7. Return all preloaded images with blob URLs

## Context Layer

### `AuthContext`

**State:**

- `user: User | null` — Firebase User object
- `initializing: boolean` — true until first `onAuthStateChanged` fires

**Methods:**

- `login(password)` — calls `authService.signInWithPassword`
- `logout()` — calls `authService.signOut`

**Lifecycle:** Sets up `onAuthStateChanged` listener on mount, cleans up on unmount.

### `GalleryContext`

The **central data hub**. Owns image metadata, preloaded blobs, loading state, and modal state.

**State shape:**

```typescript
{
  imageMetas: ImageMeta[];           // All image metadata, newest-first
  preloadedImages: PreloadedImage[]; // Thumbnail blob URLs
  isGalleryLoading: boolean;         // True while fetching
  hasGalleryLoadedOnce: boolean;     // Flips true after first successful load
  loadError: string | null;
  loadingProgress: number;           // 0-100

  // Modal state
  isModalOpen: boolean;
  modalImages: ImageMeta[];
  modalInitialIndex: number;
  modalPreloadAll: boolean;          // Preload ALL full-res vs windowed ±N
}
```

**Loading sequence (runs when `user` becomes non-null):**

```
1. Check IndexedDB cache (loadFromCache)
   ├── Cache hit  → Show cached data instantly, set hasGalleryLoadedOnce = true
   └── Cache miss → Show loading progress starting at 20%
2. Fetch fresh metadata from Firebase (fetchAllImageMetadata)
3. Diff-sync cache (syncCache) — downloads only NEW thumbnails
4. Update state with fresh data
5. Release old blob URLs to prevent memory leaks
```

**On logout / auth loss:**

- `resetState()` clears all state fields to defaults
- `clearCache()` wipes IndexedDB
- This is automatic via the `useEffect` watching `user`

**Modal API:**

| Method                                 | Use Case                                                      |
| -------------------------------------- | ------------------------------------------------------------- |
| `openModalWithImages(imgs, opts?)`     | Open lightbox with a specific image set                       |
| `openModalForImageId(id, collection?)` | Open lightbox at a specific image, optionally within a subset |
| `closeModal()`                         | Close the lightbox                                            |
| `updateModalIndex(idx)`                | Sync index when user swipes in the modal                      |

**`OpenModalOptions`:**

```typescript
{
  initialIndex?: number;   // Start at this index
  imageId?: string;        // Find this ID in the array and start there
  preloadAll?: boolean;    // If true, preload full-res for ALL images (used by timeline)
}
```

### `ToastContext`

Simple notification system.

```typescript
toast(message: string, variant?: "success" | "error" | "logout")
```

- Auto-dismisses after 1500ms with a 350ms exit animation
- Renders at a fixed position via `ToastContainer`
- Three visual variants with distinct pastel color schemes

## Hooks

### `useFullResLoader`

Used by `HomePage` and `SeeAllGalleryPage` to load full-resolution images as blob URLs.

- **`HomePage`** fetches full-res for its 6/9 chosen tiles and **gates all rendering** behind `allFullResReady` — no thumbnails are ever shown. A loading spinner is displayed until every chosen image has its full-res blob loaded.
- **`SeeAllGalleryPage`** uses it for **progressive upgrade** — thumbnails display immediately, and full-res blobs overlay them as they load.

```typescript
const { resolveUrl, requestFullRes, evict, hasFullRes } = useFullResLoader();

requestFullRes(metas); // Start fetching full-res blobs
const url = resolveUrl(meta, thumbUrl); // Returns full-res blob URL or fallback
evict(keepIds); // Release blob URLs not in the keep-set
const ready = hasFullRes(id); // Check if a specific image has full-res loaded
```

- Fetches via `fetch(meta.downloadUrl)` → blob → `URL.createObjectURL`
- Deduplicates in-flight requests via `loadingIdsRef`
- Revokes all blob URLs on unmount to prevent memory leaks

### `usePageReveal`

Returns a boolean that flips `true` shortly after mount (default 20ms delay + `requestAnimationFrame`).

```typescript
const isVisible = usePageReveal(40); // optional delay in ms
// Use in className: isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
```

Every page uses this for entrance animations. **Always apply it to new pages.**

### `useGalleryLoadingProgress` (legacy)

Standalone hook that fetches metadata + preloads thumbnails. **Not currently used by the main flow** (replaced by `GalleryContext`'s internal loading). May be used by `LoadingScreen` or for reference.

## Image Resolution Pipeline

Images go through multiple resolution stages:

```
Upload flow:
  Original file → convertToJpeg() → full-res JPEG (quality 0.9)
                → generateThumbnail() → 480px thumb JPEG (quality 0.7)
                → Upload both to Firebase Storage

Display flow:
  1. IndexedDB cache → thumbnail blob URL (instant, ~50ms)
  2. Firebase thumb URL → fallback if no cache
  3. useFullResLoader → full-res blob URL
     • HomePage: full-res only, gated behind loading spinner (no thumbnails shown)
     • SeeAllGalleryPage: progressive upgrade (thumbnail shown first, full-res overlaid)
  4. ImageModalViewer → full-res blob URL (windowed ±10/5 preload)
```

## Memory Management

The codebase is careful about blob URL lifecycle:

- **`GalleryContext`**: Calls `URL.revokeObjectURL` on old `preloadedImages` when replacing
- **`useFullResLoader`**: Revokes all URLs on unmount; `evict()` revokes URLs outside a keep-set
- **`ImageModalViewer`**: Manages its own `fullResUrls` Map, revokes on close and when evicting outside the preload window
- **`GalleryContext.resetState`**: Releases preloaded URLs on logout
