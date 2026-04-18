# Data Flow & State Management

> How metadata, cache entries, and modal state move through the app.

## End-to-End Flow

```text
Firestore (images/videos/events)
    +
Firebase Storage (media bytes)
        ↓
services/* (read/cache + admin upload/delete operations)
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
- `subscribeToAuthChanges(cb)`

Use through `useAuth()` instead of calling Firebase Auth directly.

### `mediaCacheService.ts`

IndexedDB database: `gallery-cache`.

Stores:

- `image-blobs`: image thumb blobs keyed by image id, and video thumb blobs keyed by `video:<id>`
- `meta`: manifest under key `manifest` (`ImageMeta[]`)
- `fullres-blobs`: full-resolution image blobs keyed by image id, capped at 500 MB (see below)

Main APIs:

- `loadFromCache()` -> cached image metas + thumb object URLs (if available)
- `syncCache(freshMetas, onProgress?)` -> diff image cache, download missing image thumbs, evict removed image keys, update manifest
- `syncVideoThumbCache(videoMetas)` -> cache poster thumbs only
- `loadVideoThumbUrlsFromCache(videoMetas)` -> object URL map for cached video posters
- `syncFullResCache(freshMetas, options?)` -> warm full-res blobs newest-first within `FULLRES_BUDGET_BYTES` (500 MB), evicting entries that are stale or fall outside the budget
- `loadFullResUrlsFromCache(metas)` -> object URL map for cached full-res blobs (only ids with a cached blob appear)
- `clearCache()` -> wipe all three object stores

Full-res cache behavior:

- Walks `freshMetas` by `ImageMeta.date` descending, downloading each missing image until adding the next blob would exceed the 500 MB budget.
- Images past the budget are never persisted. Opening them in the modal falls back to streaming `meta.downloadUrl` from Firebase.
- Images removed upstream (absent from `freshMetas`) are evicted. When new uploads push the newest 500 MB past the budget, the oldest-dated cached entries fall out.
- Runs as a non-blocking background task after the thumbnail sync — never gates `hasGalleryLoadedOnce`.

### `uploadService.ts`

Admin upload pipeline logic used by `UploadTab`.

Main responsibilities:

- timeline event creation (`createTimelineEvent`)
- image upload pipeline (`uploadImageWithMetadata`)
- video upload pipeline (`uploadVideoWithMetadata`)
- media preprocessing helpers (image conversion/thumbnail, video poster extraction, duration normalization)
- EXIF GPS extraction (`readGpsLocation`, via `exifr`) — runs on image upload and writes a validated `location: { lat, lng }` onto the Firestore doc when present
- unique-name resolution against both Firestore docs and Storage object existence

### `deleteService.ts`

Admin delete/edit pipeline logic used by `DeleteTab`.

Main responsibilities:

- metadata search/date normalization helpers used by delete/edit UI
- media metadata update (`updateMediaMetadata(kind, id, date, event, location?)`) — the optional `location` argument uses a three-state contract (`undefined` leaves unchanged, `null` clears, object sets) so a single `updateDoc` covers the date/event edit **and** the GPS edit in one write
- timeline event metadata update with linked media propagation (`updateTimelineEventMetadata`)
- media delete with Storage + Firestore cleanup (`deleteImageWithMetadata`, `deleteVideoWithMetadata`)
- event delete with linked media `event` cleanup (`deleteEventWithLinkedMediaCleanup`)

## Context Layer

### `AuthContext`

State:

- `user`
- `initializing`

Actions:

- `login(password)`

### `GalleryContext`

Primary app state hub.

State includes:

- `events`
- `imageMetas`
- `videoMetas`
- `preloadedImages`
- `videoThumbUrls` (blob URL map for cached video posters)
- `fullResBlobUrls` (blob URL map for cached full-res images — present only for the newest 500 MB)
- `isVideoMetadataReady`
- `loadingProgress`, `isGalleryLoading`, `hasGalleryLoadedOnce`, `loadError`
- modal state (`isModalOpen`, `modalMedia`, `modalInitialIndex`, `modalPreloadAll`)

Helpers:

- `resolveThumbUrl(imageMeta)`
- `resolveVideoThumbUrl(videoMeta)`
- `resolveFullResUrl(imageMeta)` — returns a cached full-res blob URL if available, else `null`
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
6. Kick off `syncFullResCache` in the background (does not gate ready flip); on completion, rehydrate `fullResBlobUrls`.
7. Fetch video metadata (`fetchAllVideoMetadata`).
8. Load cached video poster URLs.
9. Sync video thumb cache, then rehydrate poster URL map.
10. Mark loading complete.

If gallery fetch fails, `loadError` is set and the loading gate is still released to avoid lockup.

### Reset behavior

`resetState()` clears all gallery state when the user becomes unauthenticated:

- clears images, videos, events, modal state, progress state
- clears IndexedDB cache
- revokes cached object URLs

## Modal Data Flow

Global modal renderer (`GalleryModalRenderer`) reads modal state from `GalleryContext` and mounts `mediaModalViewer`.

`mediaModalViewer` behavior:

- supports mixed media arrays (`image` + `video`)
- image full-res preloading window:
  - desktop/default: `+10 / -5`
  - low-bandwidth mobile heuristic: `+3 / -2`
- prefers a cached full-res blob URL via `resolveFullResUrl` before falling back to `meta.downloadUrl`
- optional `preloadAll` for small sets (timeline events)
- videos are loaded on demand with `getVideoDownloadUrl`

## Page-Level Loading Behavior

### Home

- chooses a stable random subset of 12 photos
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

### Map

- pulls `imageMetas` from `GalleryContext` and filters to items with a finite, in-range, non-zero `location`
- photos-only for now (videos with `location` are ignored)
- `MapView` wraps each item in a Leaflet marker managed by `leaflet.markercluster`; cluster children are tracked in a local `WeakMap<L.Marker, GpsItem>` so cluster taps can be resolved back to media
- `maxClusterRadius: 30` keeps only tight groups collapsed; single pins stay visible at typical zooms
- cluster tap → `openModalWithMedia(clusterItems, { imageId: newestId, preloadAll: true })`, mirroring Timeline's "tap event → modal with all event media" pattern

## Upload and Delete Flows

### Upload (`UploadTab`)

- component owns UI state/progress and delegates Firebase operations to `uploadService`
- infers date from first selected file metadata (JPEG EXIF or QuickTime/MP4 `mvhd`) unless an event date is explicitly selected
- images: convert to JPEG + generate 480px thumb, upload both, then write Firestore image doc
- videos: generate poster + read duration, upload video/poster, then write Firestore video doc
- resolves unique names to avoid collisions
- refreshes gallery after successful uploads

### Delete (`DeleteTab`)

- component owns list/search/modal UI and delegates Firebase operations to `deleteService`
- delete uses confirmation modal (`Delete` -> modal `Confirm Delete`)
- image/video delete removes Storage objects and Firestore metadata doc
- media delete also removes ids from event `imageIds`
- event delete clears linked media `event` field and deletes event doc
- includes search across date/event/id tokens
- **edit**: image/video rows open `EditMetadataModal`, which now embeds `LocationField` — date/event/location save in a single `updateMediaMetadata` call; the hook (`useMetadataEditor`) JSON-diffs `currentLocation` vs `pendingLocation` so unchanged location is passed as `undefined` and stays out of the write payload

## Memory and URL Lifecycle

Blob URL cleanup is explicit:

- cached image thumb URLs are revoked when preloaded image list is replaced/unmounted
- cached video poster blob URLs are revoked when map is replaced/unmounted

Full-res images and active video playback use Firebase download URLs (not blob URLs), so browser networking/cache handles those bytes directly.
