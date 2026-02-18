# Data Flow & State Management

> How metadata, cache entries, and modal state move through the app.

## End-to-End Flow

```text
Firestore (images/videos/events)
    +
Firebase Storage (media bytes)
        ↓
services/* (fetch + normalize + URL resolution)
        ↓
GalleryContext
  - imageMetas
  - videoMetas
  - preloadedImages (image thumb blobs)
  - videoThumbUrls (cached blob URLs map)
  - events
  - loading state
  - modal state
        ↓
pages + components
  (GalleryGrid, Timeline, media modal)
```

## Service Layer

### `storageService.ts`

Source of truth for media metadata reads.

`fetchAllImageMetadata()`:

1. reads `images` collection from Firestore
2. resolves `downloadUrl` (full) + `thumbUrl` from Storage paths
3. normalizes date values into stable date-like strings
4. sorts newest-first

`fetchAllVideoMetadata()`:

1. reads `videos` collection
2. keeps only `.mp4` / `.mov` ids
3. resolves poster thumbnail URL from `thumbPath`
4. falls back to full video download URL when thumb URL fetch fails
5. normalizes `durationSeconds` to rounded integer
6. sorts newest-first

`getVideoDownloadUrl(videoPath)` is intentionally called only after a video becomes active in the modal.

Key rule: media metadata comes from Firestore docs, not Storage object custom metadata.

### `eventsService.ts`

- Queries `events` collection ordered by `date` descending.
- Maps docs to `TimelineEvent` shape.
- Uses Firestore doc ID as event id.

### `authService.ts`

- `signInWithPassword(password)` -> `signInWithEmailAndPassword(auth, config.authEmail, password)`
- `signOut()`
- `subscribeToAuthChanges(cb)`

Use through `useAuth()` instead of calling Firebase Auth directly.

### `mediaCacheService.ts`

IndexedDB database: `gallery-cache`.

Stores:

- `image-blobs`: image thumb blobs keyed by image id, and video thumb blobs keyed by `video:<id>`
- `meta`: manifest under key `manifest` (`ImageMeta[]`)

Main APIs:

- `loadFromCache()` -> cached image metas + thumb object URLs (if available)
- `syncCache(freshMetas, onProgress?)` -> diff image cache, download missing image thumbs, evict removed image keys, update manifest
- `syncVideoThumbCache(videoMetas)` -> cache poster thumbs only
- `loadVideoThumbUrlsFromCache(videoMetas)` -> object URL map for cached video posters
- `clearCache()` -> wipe both object stores

## Context Layer

### `AuthContext`

State:

- `user`
- `initializing`

Actions:

- `login(password)`
- `logout()`

### `GalleryContext`

Primary app state hub.

State includes:

- `events`
- `imageMetas`
- `videoMetas`
- `preloadedImages`
- `loadingProgress`, `isGalleryLoading`, `hasGalleryLoadedOnce`, `loadError`
- modal state (`isModalOpen`, `modalMedia`, `modalInitialIndex`, `modalPreloadAll`)

Helpers:

- `resolveThumbUrl(imageMeta)`
- `resolveVideoThumbUrl(videoMeta)`
- `openModalWithImages(...)`
- `openModalWithMedia(...)`
- `openModalForImageId(...)`
- `refreshGallery()`
- `refreshEvents()`

### `GalleryContext` load sequence (on auth user ready)

1. Kick off events fetch in a non-blocking async branch.
2. Start gallery loading state.
3. Attempt `loadFromCache()`:
   - if hit: render cached images immediately and set load flag true
4. Fetch fresh image metadata (`fetchAllImageMetadata`).
5. `syncCache` image thumbs and replace preloaded image object URLs.
6. Fetch video metadata (`fetchAllVideoMetadata`).
7. Load cached video poster URLs.
8. Sync video thumb cache, then rehydrate poster URL map.
9. Mark loading complete.

If gallery fetch fails, `loadError` is set and the loading gate is still released to avoid lockup.

### Logout/reset behavior

`resetState()` currently:

- clears images, videos, modal state, progress state
- clears IndexedDB cache
- revokes cached object URLs

Known caveat: `events` is not currently cleared inside `resetState()`.

## Modal Data Flow

Global modal renderer (`GalleryModalRenderer`) reads modal state from `GalleryContext` and mounts `mediaModalViewer`.

`mediaModalViewer` behavior:

- supports mixed media arrays (`image` + `video`)
- image full-res preloading window:
  - desktop/default: `+10 / -5`
  - low-bandwidth mobile heuristic: `+3 / -2`
- optional `preloadAll` for small sets (timeline events)
- videos are loaded on demand with `getVideoDownloadUrl`

## Page-Level Loading Behavior

### Home

- chooses a stable random subset of 9 photos
- requests full-res URLs for those ids
- displays thumbnails first and overlays full-res when available

### Photos

- groups images by year then month
- uses `IntersectionObserver` on month sections
- requests full-res for visible months plus neighborhood window (`±3`, or `±1` on low-bandwidth mobile)
- evicts off-window full-res URL mappings

### Videos

- groups videos by year then month
- renders video posters from cached map or network thumb URL fallback
- opens modal with full `videoMetas` collection for navigation

### Timeline

- events loaded from Firestore
- media linked by union of:
  - explicit `event.imageIds`
  - normalized title matching against media `event` field
- opens mixed-media modal with `preloadAll: true`

## Upload and Delete Flows

### Upload (`UploadTab`)

- infers date from first selected file metadata (JPEG EXIF or QuickTime/MP4 `mvhd`) unless an event date is explicitly selected
- images: convert to JPEG + generate 480px thumb, upload both, then write Firestore image doc
- videos: generate poster + read duration, upload video/poster, then write Firestore video doc
- resolves unique names to avoid collisions
- refreshes gallery after successful uploads

### Delete (`DeleteTab`)

- two-step inline confirm per item
- image/video delete removes Storage objects and Firestore metadata doc
- media delete also removes ids from event `imageIds`
- event delete clears linked media `event` field and deletes event doc
- includes search across date/event/id tokens

## Memory and URL Lifecycle

Blob URL cleanup is explicit:

- cached image thumb URLs are revoked when preloaded image list is replaced/unmounted
- cached video poster blob URLs are revoked when map is replaced/unmounted

Full-res images and active video playback use Firebase download URLs (not blob URLs), so browser networking/cache handles those bytes directly.
