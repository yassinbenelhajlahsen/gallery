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

Admin upload pipeline logic used by `UploadTab`. Exposes a **two-phase API** so callers can pre-upload bytes while the user is still filling out the form.

Main responsibilities:

- timeline event creation (`createTimelineEvent`)
- image staging + commit (`stageImage`, `commitImage`, `discardStagedImage`)
- video staging + commit (`stageVideo`, `commitVideo`, `discardStagedVideo`)
- media preprocessing helpers (image conversion/thumbnail, video poster extraction, duration normalization)
- EXIF GPS extraction (`readGpsLocation`, via `exifr`) — runs during `stageImage` and is carried on the returned `StagedImage` until `commitImage` writes a validated `location: { lat, lng }` onto the Firestore doc
- unique-name resolution against both Firestore docs and Storage object existence
- abortable byte transfer: `stageImage` / `stageVideo` accept an optional `AbortSignal` that wires `signal.abort()` → `uploadBytesResumable` task `cancel()`

### `deleteService.ts`

Admin delete/edit pipeline logic used by `DeleteTab`.

Main responsibilities:

- metadata search/date normalization helpers used by delete/edit UI
- media metadata update (`updateMediaMetadata(kind, id, date, event, location?)`) — the optional `location` argument uses a three-state contract (`undefined` leaves unchanged, `null` clears, object sets) so a single `updateDoc` covers the date/event edit **and** the GPS edit in one write
- timeline event metadata update with linked-media propagation (`updateTimelineEventMetadata`) — when the title changes, `updateEventFieldOnLinkedMedia` batch-updates every doc found via `where("event","==",oldTitle)` in a single Firestore batch
- media delete with Storage + Firestore cleanup (`deleteImageWithMetadata`, `deleteVideoWithMetadata`)
- event delete with linked-media `event` cleanup (`deleteEventWithLinkedMediaCleanup(eventId, eventTitle)` — `mediaIds` is no longer required; the `where`-query already covers every linked doc)

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

- `resolveThumbUrl(imageMeta)` — O(1) lookup via memoized `Map<id, objectUrl>` over `preloadedImages`
- `resolveVideoThumbUrl(videoMeta)`
- `resolveFullResUrl(imageMeta)` — returns a cached full-res blob URL if available, else `null`
- `openModalWithImages(...)`
- `openModalWithMedia(...)`
- `openModalForImageId(...)`
- `refreshGallery()` — full refetch of images + videos + thumb cache sync (used only by upload, to pick up newly uploaded thumbs)
- `refreshEvents()` — refetch of events (kept for parity; mutations no longer call it)
- **Local patch helpers** — mutation hooks use these instead of refreshing, so edits/deletes are instant:
  - `patchImageMeta(id, partial)` / `removeImageMeta(id)` (also revokes associated blob URLs)
  - `patchVideoMeta(id, partial)` / `removeVideoMeta(id)`
  - `patchEvent(id, partial)` / `removeEvent(id)` / `upsertEvent(event)` (re-sorts by date)

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
- **Two-phase upload (Instagram-style staging)**:
  - **Stage on file add** — as soon as a file enters the draft, `useUploadStaging` kicks off `stageImage` / `stageVideo`, which converts (full + thumb / poster + duration), resolves a unique name, and uploads bytes to Storage. The Firestore "publication" doc is **not** written yet, so staged blobs are invisible to the gallery.
  - **Commit on Upload click** — `useUploadOrchestrator` calls `staging.commitAll(resolveDate, eventName)`, which awaits any still-in-flight staging promises and writes the Firestore `images` / `videos` docs. For files where staging already finished, this is a single `setDoc` per file (sub-100ms).
- **File removal lifecycle** — when a file is removed from the draft before commit, `useUploadStaging` aborts the in-flight resumable upload (`task.cancel()`) and best-effort `deleteObject`s any staged blobs. After successful commit, removed/cleared files are flagged `committed` and skip discard.
- **Tab-close orphans** — intentionally not cleaned up. Bytes pre-uploaded but never committed remain in Storage with no Firestore doc; sweep manually if they accumulate.
- **Per-file progress UI** — staging progress (0–100% byte transfer) renders inline on each file chip / table row via the `entries` map from `useUploadStaging`. The "Publish Progress" panel only appears during/after the Upload click and reflects commit results (not byte transfer).
- **Stage failure** — surfaces a `Failed` badge with a `Retry` action on the chip; does not block other staged files from being committed.
- resolves unique names to avoid collisions
- refreshes gallery once after the batch commits (needed to sync newly uploaded thumbs into IndexedDB)

### Delete / Edit (`DeleteTab`)

- component owns list/search/modal UI and delegates Firebase operations to `deleteService`
- delete uses an **inline two-tap arm/confirm** pattern — first tap on `Delete` flips the button to `Confirm?`; a second tap within 3s actually deletes, and the armed state auto-disarms after 3s if the user doesn't confirm (see `useDeleteConfirmation`). There is no confirmation modal for the row-level delete
- image/video delete removes Storage objects and Firestore metadata doc
- media delete also removes ids from event `imageIds`
- event delete clears linked media `event` field (via a single `where("event","==",title)` batch, no per-id probes) and deletes event doc
- includes search across date/event/id tokens
- **edit**: image/video rows open `EditMetadataModal`, which embeds `LocationField` — date/event/location save in a single `updateMediaMetadata` call; the hook (`useMetadataEditor`) JSON-diffs `currentLocation` vs `pendingLocation` so unchanged location is passed as `undefined` and stays out of the write payload
- **No post-mutation refetch**: after every edit / delete, the hooks patch `GalleryContext` state directly (`patchImageMeta`, `removeVideoMeta`, `patchEvent`, etc.) instead of calling `refreshGallery()` / `refreshEvents()`. Photos / Videos / Timeline / DeleteTab all read from the same context state, so they update in the same tick with no network round-trip or loading flicker

## Memory and URL Lifecycle

Blob URL cleanup is explicit:

- cached image thumb URLs are revoked when preloaded image list is replaced/unmounted
- cached video poster blob URLs are revoked when map is replaced/unmounted

Full-res images and active video playback use Firebase download URLs (not blob URLs), so browser networking/cache handles those bytes directly.
