# Component & Page Reference

> Props, usage patterns, and styling details for every component and page. Use this to understand what already exists before building new features.

## Reusable Components

### `GalleryGrid`

**File:** `src/components/GalleryGrid.tsx`

Responsive tile grid for displaying image and video thumbnails. Used by gallery pages and reusable for mixed media grids.

**Props:**

```typescript
type GalleryGridProps = {
  tiles: GalleryGridTile[];
  columns?: {
    base?: number; // default 2
    sm?: number; // default 3
    md?: number; // default 4
    lg?: number; // default md value
  };
};

type GalleryGridTile = {
  id: string;
  url: string; // Thumbnail URL (shown first)
  fullUrl?: string; // Full-res URL (overlaid when loaded)
  /** Optional media discriminator for UI only */
  mediaType?: "image" | "video";
  durationSeconds?: number; // Optional video duration used for MM:SS overlay
  caption?: string;
  onClick?: () => void;
};
```

**Behavior:**

- Renders a CSS grid with configurable responsive breakpoints
- Each tile is a `<button>` with aspect-square ratio
- Implements progressive image loading: shows thumbnail, overlays full-res when `fullUrl` loads
- Video tiles show a center play indicator and a bottom-left `MM:SS` duration badge when `durationSeconds` is available
- Shows empty state placeholder when `tiles` is empty
- Internal `TileItem` component manages per-tile loading state

**Usage example (from All):**

```tsx
<GalleryGrid
  tiles={group.items.map((meta) => ({
    id: meta.id,
    url: thumbUrl,
    fullUrl: resolveUrl(meta, thumbUrl),
    caption: meta.caption ?? meta.event,
    onClick: () => handleTileClick(meta),
  }))}
  columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
/>
```

---

### `mediaModalViewer` (image + video lightbox)

**File:** `src/components/mediaModalViewer.tsx`

Full-screen lightbox that supports both images and videos. It replaces the old image-only viewer and can display mixed media arrays (images + videos) for timeline playback.

**Props (summary):**

- `media: MediaMeta[]` — array of media objects (images/video) where images have `type: 'image'` and videos `type: 'video'`
- `initialIndex?: number` — start index
- `isOpen: boolean` — modal visibility
- `onClose: () => void`
- `onChangeIndex?: (nextIndex: number) => void`
- `resolveThumbUrl?: (image: ImageMeta) => string` — placeholder thumbnails for images
- `resolveVideoThumbUrl?: (video: VideoMeta) => string` — poster/thumb URL for videos
- `preloadAll?: boolean` — when true, preload ALL image full-res (ignored for videos)

**Key internals:**

- Manages full-res download URLs for images with windowed preloading (±10 ahead / ±5 behind) and evicts outside the window
- Plays videos on demand — video bytes are not prefetched during gallery load; posters are used for thumbnails
- Supports keyboard nav, touch swipe, and proper URL lifecycle handling

Open the media modal via `GalleryModalRenderer` / `useGallery()` helpers (do not mount directly).

---

### `GalleryModalRenderer`

**File:** `src/components/GalleryModalRenderer.tsx`

Thin bridge between `GalleryContext` and the global `mediaModalViewer`. Mounted once in `App.tsx`, outside the router.

```tsx
// This is the entire component — it wires context to the media modal
<mediaModalViewer
  media={modalMedia}
  initialIndex={modalInitialIndex}
  isOpen={isModalOpen}
  onClose={closeModal}
  onChangeIndex={updateModalIndex}
  resolveThumbUrl={resolveThumbUrl}
  resolveVideoThumbUrl={resolveVideoThumbUrl}
  preloadAll={modalPreloadAll}
/>
```

**To open the modal from any page:**

```tsx
const { openModalWithImages, openModalForImageId } = useGallery();

// Option A: Open with a specific image set
openModalWithImages(imageArray, { initialIndex: 2 });

// Option B: Open at a specific image ID
openModalForImageId("photo1.jpg");

// Option C: Open at an image ID within a specific collection
openModalForImageId("photo1.jpg", filteredImages);

// Option D: Preload all full-res (small sets like timeline events)
openModalWithImages(eventImages, { preloadAll: true });
```

---

### `TimelineEventItem`

**File:** `src/components/TimelineEventItem.tsx`

Single row in the timeline list. Clickable only when it has linked images.

**Props:**

```typescript
export type MediaCounts = {
  imageCount: number;
  videoCount: number;
};

type TimelineEventItemProps = {
  event: TimelineEvent;
  onSelect: (event: TimelineEvent) => void;
  mediaCounts?: MediaCounts;
};

type TimelineEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  emojiOrDot?: string; // Emoji or "•" shown as leading icon
  imageIds?: string[]; // Explicit image IDs linked to this event
};
```

**Behavior:**

- Renders as a `<button>` — disabled when `linkedImageCount === 0`
- Disabled state: dashed border, reduced opacity, cursor-not-allowed
- Active state: solid border, hover scale effect
- Displays formatted date, title, and photo count

---

### `Navbar`

**File:** `src/components/Navbar.tsx`

Sticky top navigation bar. Auto-highlights active route.

**Routes defined:**

```typescript
const NAV_ITEMS = [
  { label: "Timeline", to: "/timeline", activeClass: "bg-[#D8ECFF]" },
  { label: "Photos", to: "/photos", activeClass: "bg-[#FFE39F]" },
  { label: "Videos", to: "/videos", activeClass: "bg-[#F3D0D6]" },
];
```

Each nav item gets a distinct pastel highlight when active. `Home` routes via the brand link on desktop and a dedicated mobile link. The Navbar no longer contains upload/logout actions; admin access + logout live in `Footer`.

---

### `FloatingInput`

**File:** `src/components/ui/FloatingInput.tsx`

Reusable floating-label input field with error state support.

**Props:**

```typescript
type FloatingInputProps = {
  id: string;
  type: "text" | "email" | "password" | "date";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode; // e.g. show/hide password toggle
  inputRef?: React.RefObject<HTMLInputElement>;
  autoComplete?: string;
  minLength?: number;
  required?: boolean; // default true
  disabled?: boolean;
  className?: string;
  error?: string; // Shows red border + error styling
  // Visual customizations (optional)
  focusColor?: string; // color used for border / ring on focus (hex)
  borderColor?: string; // default border color (hex)
  labelColor?: string; // optional override for the floating label color
  // Plus: inputMode, autoCapitalize, autoCorrect, spellCheck
};
```

---

### `Footer`

**File:** `src/components/Footer.tsx`

Simple centered footer: `Made with ♥ for {config.coupleDisplay}` plus:
- `Admin` button linking to `/admin?tab=upload`
- `Logout` button

### `ScrollToTop`

**File:** `src/components/ScrollToTop.tsx`

Utility component mounted inside `MainLayout`. Scrolls to top on every pathname change via `useLocation()`.

---

## Pages

### `HomePage`

**File:** `src/pages/HomePage.tsx`

- Picks a random subset of images (6 mobile / 9 desktop) and renders them using the `GalleryGrid` component
- Stable selection: re-picks only when the set of available IDs changes
- Uses `useFullResLoader` to fetch full-resolution images in the background while showing thumbnails immediately
- Shows a short skeleton while the chosen subset is being selected; thumbnails render instantly (progressive upgrade) and full-res images overlay as they become available
- The grid, "See All" button, and empty state are shown immediately (when thumbnails are available) rather than gating on full-res readiness
- Clicking a tile opens the modal with the displayed subset
- "See All" button navigates to `/photos`

### `PhotosPage`

**File:** `src/pages/PhotosPage.tsx`

- Groups all `imageMetas` by year (newest-first)
- Each year section uses `GalleryGrid` with `{ base: 1, sm: 2, md: 3, lg: 4 }` columns
- Uses `IntersectionObserver` to detect visible year-groups
- Preloads full-res for visible groups ± 3 groups (1 on mobile) ahead/behind
- Evicts full-res download URLs for off-screen groups (memory management)
- Clicking any tile opens the modal with the **full** `imageMetas` array (all photos navigable)

### `TimelinePage`

**File:** `src/pages/TimelinePage.tsx`

- Reads events from `GalleryContext` (loaded from Firestore on app launch) and sorts newest-first
- Links images to events via two methods:
  1. Explicit `imageIds` array on the event
  2. Matching `event` metadata on uploaded images (normalized, case-insensitive)
- Both methods are combined (union, no duplicates)
- Clicking an event opens the modal with `preloadAll: true` (small image sets)

### `AdminPage`

**File:** `src/pages/AdminPage.tsx`

- Admin container with `Upload` and `Delete` tabs
- Tab control uses a sliding segmented-button UI with a moving active pill
- Tab content also slides between panes
- Content height animates to the active tab, so inactive tab content doesn't force long page height
- Admin route and tab panels are lazy-loaded for smaller initial bundle cost

### `AdminUploadTab`

**File:** `src/components/admin/AdminUploadTab.tsx`

- File selection → client-side JPEG conversion → upload to Firebase Storage
- Generates both full-res JPEG (quality 0.9) and thumbnail (480px, quality 0.7) for images
- Generates poster thumbnails for videos (first frame extraction) and reads video duration from metadata
- Uploads to `images/full/<name>.jpg` and `images/thumb/<name>.jpg` for photos, `videos/full/` and `videos/thumb/` for videos
- Writes media metadata to Firestore docs (`images` / `videos`) after successful Storage uploads, including `durationSeconds` for videos
- Event dropdown auto-fills date and event name from events loaded in `GalleryContext`
- File selection infers date from the first selected file's embedded media metadata (JPEG EXIF `DateTimeOriginal`, MOV/MP4 creation time), then falls back to file `lastModified`
- If the current date was populated from an event, metadata date inference is skipped and that event date remains the upload date
- Includes inline event creation form using Firestore-generated document IDs
- Per-file progress tracking with status: pending → converting → uploading → success/error
- Uses `useToast` for success notification
- Automatically refreshes gallery after successful uploads to show new content immediately

### `AdminDeleteTab`

**File:** `src/components/admin/AdminDeleteTab.tsx`

- Delete tools for images, videos, and timeline events
- Two-step inline confirmation (`Delete` → `Confirm Delete`) without modal
- Image/video delete removes:
  - Firebase Storage `full` + `thumb` objects
  - Firestore metadata docs (`images` / `videos`)
- Event delete removes:
  - Firestore event doc (`events`)
  - Related media `event` fields (set to `null`)
- Lists render single-column on mobile and 2-column on larger screens

### `LoginPage`

**File:** `src/pages/LoginPage.tsx`

- Single password field (email is hardcoded in config)
- Calls `useAuth().login(password)`
- On success, `GuestRoute` automatically redirects to `/loading` → `/home`

### `LoadingScreen`

**File:** `src/pages/LoadingScreen.tsx`

- Displays while `hasGalleryLoadedOnce` is false
- Shows progress bar driven by `GalleryContext.loadingProgress`
- `ProtectedRoute` with `redirectIfGalleryReadyTo="/home"` handles the redirect once loading finishes

### `NotFoundPage`

**File:** `src/pages/NotFoundPage.tsx`

- Static 404 page with message from `config.notFoundText`
- Link back to `/home`
