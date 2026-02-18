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

Current nav items:

- `/timeline`
- `/photos`
- `/videos`
- plus home access (`/home`) via brand link (desktop) and explicit mobile item

### `Footer`

- File: `src/components/layout/Footer.tsx`
- Purpose: bottom controls.

Includes:

- `Admin` link -> `/admin?tab=upload`
- `Logout` action via `useAuth().logout()` + toast

### `ScrollToTop`

- File: `src/components/layout/ScrollToTop.tsx`
- Purpose: scroll to top on pathname change.

### `FloatingInput`

- File: `src/components/ui/FloatingInput.tsx`
- Purpose: reusable floating-label input with optional icons/slots and error display.

## Pages

### `LoginPage`

- File: `src/pages/LoginPage.tsx`
- Single password form (email comes from config/auth service)
- Redirects to `/loading` on success
- Wrapped by `GuestRoute`

### `LoadingScreen`

- File: `src/pages/LoadingScreen.tsx`
- Animated loader driven by `GalleryContext.loadingProgress`
- Route redirects to `/home` when `hasGalleryLoadedOnce` becomes true

### `HomePage`

- File: `src/pages/HomePage.tsx`
- Chooses stable random subset of 9 images
- Uses `GalleryGrid`
- Shows thumbs first and overlays full-res URLs when resolved
- Tile click opens modal with current subset
- CTA navigates to `/photos`

### `PhotosPage`

- File: `src/pages/PhotosPage.tsx`
- Groups images by year then month
- Month sections observed with `IntersectionObserver`
- Requests full-res for visible groups plus buffer window (`±3`, or `±1` on low-bandwidth mobile)
- Evicts off-window full-res URL mappings

### `VideosPage`

- File: `src/pages/VideosPage.tsx`
- Groups videos by year then month
- Uses poster thumbs (`resolveVideoThumbUrl` fallback to metadata thumb URL)
- Opens modal with full video collection at clicked item

### `TimelinePage`

- File: `src/pages/TimelinePage.tsx`
- Reads events from `GalleryContext`
- Links media by union of explicit ids and normalized title matching
- Opens mixed-media modal (`openModalWithMedia`) with `preloadAll: true`

### `AdminPage`

- File: `src/pages/AdminPage.tsx`
- Tab container controlled by `?tab=upload|delete`
- Lazy-loads `UploadTab` and `DeleteTab`
- Animated active pill + panel slide + dynamic panel height

### `UploadTab`

- File: `src/components/admin/UploadTab.tsx`

Capabilities:

- event creation (`events` collection)
- event selection auto-filling date + event title
- upload images and videos in one flow
- date inference from first file metadata unless event date is selected
- per-file progress and status

Upload pipeline:

- images: `convertToJpeg` + `generateThumbnail` -> upload to `images/full` + `images/thumb` -> write Firestore doc
- videos: `extractVideoPoster` + duration extraction -> upload to `videos/full` + `videos/thumb` -> write Firestore doc

### `DeleteTab`

- File: `src/components/admin/DeleteTab.tsx`

Capabilities:

- search across images, videos, events
- two-step confirm delete (`Delete` -> `Confirm Delete`)
- media delete removes Storage + Firestore metadata + event id references
- event delete clears linked media `event` field and removes event doc

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
