# Component & Page Reference

> Practical map of the current UI layer: what each component/page does and how it is meant to be used.

## Core Reusable Components

### `GalleryGrid`

- File: `src/components/gallery/GalleryGrid.tsx`
- Purpose: shared square-tile grid for image and video thumbnails.

Props summary:

- `tiles: GalleryGridTile[]`
- optional responsive `columns` (`base`, `sm`, `md`, `lg`)

Tile fields:

- `id`, `url`
- optional `fullUrl` (image progressive overlay)
- optional `mediaType: "image" | "video"`
- optional `durationSeconds`
- optional `caption`, `onClick`

Behavior:

- thumbnail-first rendering, full image overlay when `fullUrl` resolves
- video duration badge on video tiles
- empty state message if no tiles

### `mediaModalViewer`

- File: `src/components/gallery/mediaModalViewer.tsx`
- Purpose: full-screen mixed-media modal used across gallery pages.

Supports:

- image + video arrays (`MediaMeta[]`)
- keyboard nav (`←`, `→`, `Esc`)
- touch swipe
- index dots/progress UI
- safe-area-aware layout

Data behavior:

- images: preloads full-res download URLs in a moving window (or all when `preloadAll`)
- videos: resolves active video URL only when video slide is active

Logic decomposition (all under `src/hooks/`):

- `useCarouselNavigation` — visual/data indices, wrap-around teleport, slide timing
- `useModalViewportLock` — body scroll lock + iOS bottom-nav pinning
- `useModalVideoManager` — token-cancelled video URL fetch + `<video>` cleanup
- `useFullResPreloader` — windowed full-res URL preload + eviction
- `useMediaSwipeGesture` — touch start/move/end with velocity threshold

Keyboard shortcuts and focus trap are inline `useEffect`s; the component owns three refs (slide container, modal root, video element) and passes them into hooks that need DOM access.

### `GalleryModalRenderer`

- File: `src/components/gallery/GalleryModalRenderer.tsx`
- Purpose: bridge from `GalleryContext` modal state to `mediaModalViewer`.
- Mounted once in authenticated route shell (`GalleryAppShell`).

Do not mount another modal instance directly in pages.

### `TimelineEventItem`

- File: `src/components/timeline/TimelineEventItem.tsx`
- Purpose: a timeline row with media availability state.

Props:

- `event`
- `onSelect(event)`
- `mediaCounts: { imageCount; videoCount }`

Behavior:

- disabled when both counts are zero
- shows formatted local date, title, and media counts

### `Navbar`

- File: `src/components/layout/Navbar.tsx`
- Purpose: top-level navigation.

Renders two separate structures:

- **Desktop**: a `<header>` fixed at top. Transparent by default; transitions to a solid `#FAFAF7` background once `window.scrollY > 10px` (passive scroll listener).
- **Mobile**: a bottom tab `<nav>` fixed at bottom. Always solid `#FAFAF7`.

Current nav items (order matches the bottom tab bar):

- `/timeline`
- `/map`
- `/photos`
- `/videos`
- plus home access (`/`) via brand link (desktop) and explicit mobile item

Each item carries its own pastel active-state color (`#D8ECFF` timeline, `#CFE8E1` map, `#FFE39F` photos, `#F3D0D6` videos).

### `Footer`

- File: `src/components/layout/Footer.tsx`
- Purpose: bottom controls.

Includes:

- `Admin` link -> `/admin?tab=upload`

### `ScrollToTop`

- File: `src/components/layout/ScrollToTop.tsx`
- Purpose: scroll to top on pathname change.

### `FloatingInput`

- File: `src/components/ui/FloatingInput.tsx`
- Purpose: reusable floating-label input with optional icons/slots and error display.

### `LocationField`

- File: `src/components/ui/LocationField.tsx`
- Purpose: GPS picker field embedded inside `EditMetadataModal` for image/video drafts.

Behavior:

- Debounced (400ms, 3-char minimum) address search against Nominatim (`nominatim.openstreetmap.org/search`) — no API key. Results render as a dropdown; click or press Enter on the first to drop a pin.
- Embeds `LocationPickerMap` (260px) — tap map to place the pin, drag the pin to fine-tune.
- Shows `Current` (original) vs `Pending` (staged) coordinates below the map.
- Exposes a `Remove pin` control when a pin exists.

Props: `value`, `originalValue`, `onChange(location | null)`, `disabled`.

### `MapView`

- File: `src/components/map/MapView.tsx`
- Purpose: map used by `/map` — clusters photo + video pins and routes cluster taps to the global modal.

Behavior:

- Leaflet `MapContainer` with CartoDB Positron tiles (free, attribution-only, cached by the PWA service worker under `map-tiles-cache`).
- `leaflet.markercluster` wrapper with `zoomToBoundsOnClick: false`, `maxClusterRadius: 30`, and `removeOutsideVisibleBounds: false` (keeps every pin in the DOM so fast mobile panning never visibly culls markers). Tapping a cluster calls `onClusterSelect(clusterItems, firstNewest)` instead of zooming. Child items are retrieved via a local `WeakMap<L.Marker, GpsItem>`.
- Cluster items are sorted newest-first for stable modal ordering.
- `FitBounds` sub-component refits the view when the item set changes (signature-guarded to avoid refit loops).
- Custom `DivIcon`s — a single mint-dot pin (`gallery-pin`) for both photos and videos and a serif-numbered pill for clusters (`gallery-cluster`); styles live in `components/map/mapStyles.css`.

### `LocationPickerMap`

- File: `src/components/map/LocationPickerMap.tsx`
- Purpose: single-pin picker used inside `LocationField`.

Behavior:

- Click map → set pin; drag pin → update.
- Default center: Brooklyn (`40.63128, -73.97335`) at zoom 12 when no initial location; otherwise centers on the provided location.
- `RecenterOnValue` sub-component pans the map whenever `value` changes from an external source (address search result).

### `ErrorBoundary` / `RouteErrorPage`

- File: `src/components/ui/ErrorBoundary.tsx`
- `ErrorBoundary`: React class boundary catching render/runtime errors. Mounted once in `src/App.tsx` wrapping `<RouterProvider>` so it catches failures outside React Router's own error flow.
- `RouteErrorPage`: functional component wired as `errorElement` on the authenticated shell route in `src/App.tsx`. Reads `useRouteError()` and renders a recoverable fallback for loader/action errors.

## Pages

### `LoginPage`

- File: `src/pages/LoginPage.tsx`
- Single password form (email comes from config/auth service)
- Redirects to `/loading` on success
- Wrapped by `GuestRoute`

### `LoadingScreen`

- File: `src/pages/LoadingScreen.tsx`
- Animated loader driven by `GalleryContext.loadingProgress`
- Route redirects to `/` when `hasGalleryLoadedOnce` becomes true

### `HomePage`

- File: `src/pages/HomePage.tsx`
- Chooses stable random subset of 12 images
- Uses `GalleryGrid`
- Shows thumbs first and overlays full-res URLs when resolved
- Tile click opens modal with current subset
- CTA navigates to `/photos`

### `PhotosPage`

- File: `src/pages/PhotosPage.tsx`
- Groups images by year then month via `useYearMonthGrouping` (shared with `VideosPage`)
- Month sections observed with `IntersectionObserver`
- Requests full-res for visible groups plus buffer window (`±3`, or `±1` on low-bandwidth mobile)
- Evicts off-window full-res URL mappings

### `VideosPage`

- File: `src/pages/VideosPage.tsx`
- Groups videos by year then month via `useYearMonthGrouping`
- Uses poster thumbs (`resolveVideoThumbUrl` fallback to metadata thumb URL)
- Opens modal with full video collection at clicked item

### `TimelinePage`

- File: `src/pages/TimelinePage.tsx`
- Reads events from `GalleryContext`
- Search/filter via `useMediaSearch` (shared with `DeleteTab`) — tokenized AND match against title/date/event ids
- Links media by union of explicit ids and normalized title matching
- Opens mixed-media modal (`openModalWithMedia`) with `preloadAll: true`

### `MapPage`

- File: `src/pages/MapPage.tsx`
- Pulls `imageMetas` + `videoMetas` from `GalleryContext` and filters to items with a valid `location` (finite lat/lng in range, not `0/0`). Photo and video pins render identically.
- Renders `MapView`; cluster/pin taps call `openModalWithMedia(items, { imageId, preloadAll: true })` (same pattern as Timeline event taps).
- Empty state points users at EXIF upload or the `npm run backfill:gps` script.
- Map container height scales to viewport with `svh`/`vh` and grows further in PWA standalone mode (`[@media(display-mode:standalone)]:h-[calc(100svh-180px)]`) so it feels full-screen when installed.

### `AdminPage`

- File: `src/pages/AdminPage.tsx`
- Tab container controlled by `?tab=upload|delete`
- Loads `UploadTab` and `DeleteTab`
- Underline-tab navigation; tab state driven by `?tab=upload|delete` query string

### `UploadTab`

- File: `src/components/admin/UploadTab.tsx`
- Service dependency: `src/services/uploadService.ts`
- Logic decomposition:
  - `useEventCreation` — new-event form state + `createTimelineEvent` call
  - `useUploadForm` — file picker, per-file metadata probe, date-source resolution, event selection
  - `useUploadStaging` — owns the per-file pre-upload lifecycle (stage on add, abort + discard on remove, retry on error)
  - `useUploadOrchestrator` — on Upload click, runs `staging.commitAll(...)` and surfaces the publish results

Capabilities:

- event creation (`events` collection)
- event selection auto-filling date + event title
- upload images and videos in one flow
- date inference from first file metadata unless event date is selected
- **Silent pre-upload (Instagram-style)**: bytes are pushed to Storage as soon as a file is added to the draft — without any inline status indicator on the chip / table row. The user perceives the upload as starting only when they click `Upload Media`. Behind the scenes, the click writes the Firestore `images` / `videos` docs (`commitImage` / `commitVideo`) — sub-100ms per file when staging already finished, otherwise it awaits the in-flight bytes. The `Upload Progress` panel shown after the click reflects real per-file byte progress (driven by the staging entry map) so it doesn't look fake when staging is still in flight.
- **File removal**: removing a file from the draft silently aborts the in-flight resumable upload and best-effort deletes any already-staged Storage blobs, so the gallery never sees them.
- delegates upload/event create operations to `uploadService` helpers

Upload pipeline (per file):

- images: `stageImage` (`convertToJpeg` + `generateThumbnail` + EXIF GPS read + parallel `uploadBytesResumable` of full/thumb) → on Upload click, `commitImage` (single Firestore `setDoc`)
- videos: `stageVideo` (`extractVideoPoster` + duration + parallel `uploadBytesResumable` of video/poster) → on Upload click, `commitVideo`
- combined full+thumb byte transfer is summed to a single 0–1 fraction and reported through the staging hook so the inline chip progress bar advances smoothly

### `DeleteTab`

- File: `src/components/admin/DeleteTab.tsx`
- Service dependency: `src/services/deleteService.ts`
- Logic decomposition:
  - `useMediaSearch` — tokenized search across images/videos/events (also used by `TimelinePage`)
  - `useMetadataEditor` — edit draft state, validation, save
  - `useDeleteConfirmation` — two-step arm/confirm state + delete orchestration

Capabilities:

- search across images, videos, events
- metadata editing via `EditMetadataModal` — for image/video rows the modal includes `LocationField`, so date, event, and GPS location all save in one `updateMediaMetadata` call
- inline two-tap arm/confirm delete: the `Delete` button flips to `Confirm?` on first tap and auto-disarms after 3 s. Second tap within that window runs the delete. This replaces the previous `DeleteConfirmModal` flow
- media delete removes Storage + Firestore metadata + event id references
- event delete clears linked media `event` field and removes event doc
- delegates metadata update + destructive operations to `deleteService` helpers
- **No post-mutation refetch**: edit/delete hooks patch `GalleryContext` state directly (`patchImageMeta`, `removeImageMeta`, `patchEvent`, `removeEvent`, etc.). The list re-renders from the patched state in the same tick — no `refreshGallery()` / `refreshEvents()` round-trip, no loading flicker

### `NotFoundPage`

- File: `src/pages/NotFoundPage.tsx`
- 404 with env-driven message and home link

## Modal Opening API (from `useGallery()`)

Use these helpers instead of mounting modal directly:

- `openModalWithImages(images, options?)`
- `openModalWithMedia(media, options?)`
- `openModalForImageId(imageId, collection?)`

`options`:

- `initialIndex?: number`
- `imageId?: string`
- `preloadAll?: boolean` (applies to image preloading behavior)
