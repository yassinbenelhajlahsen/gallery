# Component & Page Reference

> Props, usage patterns, and styling details for every component and page. Use this to understand what already exists before building new features.

## Reusable Components

### `GalleryGrid`

**File:** `src/components/GalleryGrid.tsx`

Responsive tile grid for displaying images. Used by `SeeAllGalleryPage` and can be reused anywhere a photo grid is needed.

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
  caption?: string;
  onClick?: () => void;
};
```

**Behavior:**

- Renders a CSS grid with configurable responsive breakpoints
- Each tile is a `<button>` with aspect-square ratio
- Implements progressive image loading: shows thumbnail, overlays full-res when `fullUrl` loads
- Shows empty state placeholder when `tiles` is empty
- Internal `TileItem` component manages per-tile loading state

**Usage example (from SeeAllGalleryPage):**

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

### `ImageModalViewer`

**File:** `src/components/ImageModalViewer.tsx` (664 lines)

Full-screen lightbox with keyboard nav, touch swipe, and progressive full-res loading.

**Props:**

```typescript
type ImageModalViewerProps = {
  images: ImageMeta[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex?: (nextIndex: number) => void;
  resolveThumbUrl?: (image: ImageMeta) => string;
  preloadAll?: boolean; // Preload ALL full-res vs windowed ±N
};
```

**Key internals:**

- Manages its own `fullResUrls: Map<string, string>` for full-resolution blob URLs
- **Windowed preloading**: By default loads ±10 ahead / ±5 behind the active index
- **preloadAll mode**: Loads every image's full-res (used by timeline events with small sets)
- Evicts blob URLs outside the preload window to conserve memory
- Supports `left`/`right` keyboard arrows, Escape to close, touch swipe gestures
- Wraps around at both ends (index clamping loops)
- Shows image date and caption in overlay metadata

**Do NOT mount this directly** — use `GalleryModalRenderer` + `useGallery().openModalWithImages()`.

---

### `GalleryModalRenderer`

**File:** `src/components/GalleryModalRenderer.tsx`

Thin bridge between `GalleryContext` and `ImageModalViewer`. Mounted once in `App.tsx`, outside the router.

```tsx
// This is the entire component — it just wires context to props
<ImageModalViewer
  images={modalImages}
  initialIndex={modalInitialIndex}
  isOpen={isModalOpen}
  onClose={closeModal}
  onChangeIndex={updateModalIndex}
  resolveThumbUrl={resolveThumbUrl}
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
type TimelineEventItemProps = {
  event: TimelineEvent;
  onSelect: (event: TimelineEvent) => void;
  linkedImageCount?: number;
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
  { label: "Home", to: "/home", activeClass: "bg-[#F7DEE2]" },
  { label: "Timeline", to: "/timeline", activeClass: "bg-[#D8ECFF]" },
  { label: "See All", to: "/gallery", activeClass: "bg-[#FFE39F]" },
];
```

Each nav item gets a distinct pastel highlight when active. Logout button with an SVG icon is on the right.

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
  // Plus: inputMode, autoCapitalize, autoCorrect, spellCheck
};
```

---

### `Footer`

**File:** `src/components/Footer.tsx`

Simple centered footer: `Made with ♥ for {config.coupleDisplay}`.

### `ScrollToTop`

**File:** `src/components/ScrollToTop.tsx`

Utility component mounted inside `MainLayout`. Scrolls to top on every pathname change via `useLocation()`.

---

## Pages

### `HomePage`

**File:** `src/pages/HomePage.tsx`

- Picks a random subset of images (6 mobile / 9 desktop) and renders them in a grid
- Stable selection: re-picks only when the set of available IDs changes
- Uses `useFullResLoader` to progressively upgrade thumbnails to full-res
- Clicking a tile opens the modal with the displayed subset
- "See All" button navigates to `/gallery`

### `SeeAllGalleryPage`

**File:** `src/pages/SeeAllGalleryPage.tsx`

- Groups all `imageMetas` by year (newest-first)
- Each year section uses `GalleryGrid` with `{ base: 1, sm: 2, md: 3, lg: 4 }` columns
- Uses `IntersectionObserver` to detect visible year-groups
- Preloads full-res for visible groups ± 3 groups ahead/behind
- Evicts full-res blob URLs for off-screen groups (memory management)
- Clicking any tile opens the modal with the **full** `imageMetas` array (all photos navigable)

### `TimelinePage`

**File:** `src/pages/TimelinePage.tsx`

- Reads `events.json` and sorts newest-first
- Links images to events via two methods:
  1. Explicit `imageIds` array on the event
  2. Matching `event` metadata on uploaded images (normalized, case-insensitive)
- Both methods are combined (union, no duplicates)
- Clicking an event opens the modal with `preloadAll: true` (small image sets)

### `UploaderPage`

**File:** `src/pages/UploaderPage.tsx`

- File selection → client-side JPEG conversion → upload to Firebase Storage
- Generates both full-res JPEG (quality 0.9) and thumbnail (480px, quality 0.7)
- Uploads to `images/full/<name>.jpg` and `images/thumb/<name>.jpg` in parallel
- Writes `date` and `event` as custom metadata on both files
- Event dropdown auto-fills date and event name from `events.json`
- Per-file progress tracking with status: pending → converting → uploading → success/error
- Uses `useToast` for success notification

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
