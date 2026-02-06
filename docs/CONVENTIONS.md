# Conventions & How-To Guides

> Patterns, rules, and step-by-step recipes for common development tasks. Follow these to keep the codebase consistent.

## Code Conventions

### TypeScript

- Strict mode enabled (`tsconfig.app.json`)
- Use `type` imports: `import type { ImageMeta } from "../services/storageService"`
- Prefer `satisfies` over `as` for type-safe object literals
- All components use `React.FC<Props>` or plain function signatures
- No `any` — use `unknown` and narrow

### React Patterns

- **Functional components only** — no class components
- **`useCallback` / `useMemo`** for all non-trivial values passed to children or used in dependency arrays
- **Cleanup in effects** — always return a cleanup function if the effect creates subscriptions, timers, or blob URLs
- **Cancellation flags** in async effects: `let cancelled = false; ... return () => { cancelled = true; }`
- **`useRef`** for mutable values that shouldn't trigger re-renders (e.g., `loadingIdsRef`, `mountedRef`)

### Styling

- **Tailwind-first** — no CSS modules or styled-components
- Pastel color palette — see palette below
- Use Tailwind utility classes directly in JSX `className`
- For responsive breakpoints: `sm:`, `md:`, `lg:` (mobile-first)
- Animations use `transition-all duration-200` or `duration-400` with `ease-out`
- Interactive elements get `touch-manipulation` for mobile tap delay removal
- Hover effects: `hover:scale-[1.03]` / `active:scale-[0.98]` pattern

**Core color palette:**
| Token | Hex | Usage |
| ------------- | ----------- | ------------------------------ |
| Background | `#FAFAF7` | Page background |
| Text primary | `#333` | Body text |
| Text muted | `#777` | Secondary text |
| Pink pastel | `#F7DEE2` | Home nav active, accents |
| Blue pastel | `#D8ECFF` | Timeline nav active, accents |
| Gold pastel | `#FFE39F` | Gallery nav active, badges |
| Card bg | `white/80` | Card backgrounds (with blur) |
| Border | `#EDEDED` | Subtle borders |
| Heart pink | `#F7889D` | Heart accent color |

**Card pattern:**

```
rounded-[36px] bg-white/80 p-10 shadow-[0_35px_120px_rgba(248,180,196,0.35)]
ring-1 ring-white/60 backdrop-blur-2xl
```

### File Organization

- **Pages** → `src/pages/` — full-page components, assume providers are mounted
- **Components** → `src/components/` — reusable presentational pieces
- **UI primitives** → `src/components/ui/` — low-level form elements
- **Hooks** → `src/hooks/` — custom React hooks
- **Context** → `src/context/` — React context providers
- **Services** → `src/services/` — Firebase / external API wrappers
- **Assets** → `src/assets/` — static JSON data, images

---

## How-To Guides

### Adding a New Page

1. **Create the page component** in `src/pages/NewPage.tsx`:

   ```tsx
   import React from "react";
   import { usePageReveal } from "../hooks/usePageReveal";

   const NewPage: React.FC = () => {
     const isVisible = usePageReveal();

     return (
       <section className="flex w-full justify-center">
         <div
           className={`mx-auto w-full max-w-5xl space-y-10 rounded-[36px] bg-white/80 p-10
             shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl
             transition-all duration-400 ease-out
             ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
         >
           {/* Page content */}
         </div>
       </section>
     );
   };

   export default NewPage;
   ```

2. **Add the route** in `src/App.tsx` inside the `children` array of the `"/"` layout route:

   ```tsx
   { path: "new-page", element: <NewPage /> },
   ```

3. **(Optional) Add nav link** in `src/components/Navbar.tsx`:

   ```tsx
   { label: "New", to: "/new-page", activeClass: "bg-[#D8ECFF]" },
   ```

4. **Key rules:**
   - Always use `usePageReveal()` for entrance animation
   - Page renders inside `MainLayout` — Navbar, Footer, ScrollToTop are automatic
   - Access data via `useGallery()`, `useAuth()`, `useToast()` — never import providers

### Opening the Image Modal

**Never** mount `ImageModalViewer` directly. Use the global instance via context:

```tsx
const { openModalWithImages, openModalForImageId } = useGallery();

// Open with a subset of images
openModalWithImages(someImages, { initialIndex: 0 });

// Open at a specific image (searches imageMetas or provided collection)
openModalForImageId("photo1.jpg");

// Open with full preloading (for small sets, like timeline events)
openModalWithImages(eventImages, { preloadAll: true });
```

### Displaying Images in a Grid

Use `GalleryGrid` for any image grid. For progressive full-res loading (used by `SeeAllGalleryPage`):

```tsx
import { useFullResLoader } from "../hooks/useFullResLoader";
import { useGallery } from "../context/GalleryContext";
import GalleryGrid from "../components/GalleryGrid";

const { imageMetas, resolveThumbUrl } = useGallery();
const { resolveUrl, requestFullRes } = useFullResLoader();

// Start loading full-res for visible images
useEffect(() => {
  requestFullRes(visibleMetas);
}, [visibleMetas]);

// Build tiles
const tiles = metas.map((meta) => {
  const thumbUrl = resolveThumbUrl(meta);
  return {
    id: meta.id,
    url: thumbUrl,
    fullUrl: resolveUrl(meta, thumbUrl),
    onClick: () => openModalForImageId(meta.id),
  };
});

<GalleryGrid tiles={tiles} columns={{ base: 2, sm: 3, md: 4 }} />;
```

For **full-res-only rendering** (used by `HomePage`), gate the UI behind `hasFullRes`:

```tsx
const { resolveUrl, requestFullRes, hasFullRes } = useFullResLoader();

// Check all images are loaded before showing any content
const allReady =
  chosenIds.length > 0 && chosenIds.every((id) => hasFullRes(id));

// Show spinner until ready, then render images with full-res blob URLs only
```

### Adding a Timeline Event

Edit `src/assets/events.json`:

```json
{
  "id": "unique-event-id",
  "date": "2026-01-15",
  "title": "Event Title",
  "emojiOrDot": "🎉",
  "imageIds": ["photo1.jpg", "photo2.jpg"]
}
```

**Rules:**

- `id` must be unique across all events
- `date` must be `YYYY-MM-DD` format
- `imageIds` are optional — images also link by matching `event` metadata to `title` (case-insensitive)
- Events auto-sort newest-first in `TimelinePage`

### Uploading Images (Programmatically)

Follow the same pattern as `UploaderPage.tsx`:

1. Convert to JPEG client-side (use the `loadImage` → `convertToJpeg` pipeline)
2. Generate a 480px thumbnail (`generateThumbnail`)
3. Upload both to `images/full/<name>.jpg` and `images/thumb/<name>.jpg`
4. Set `customMetadata: { date: "YYYY-MM-DD", event: "Event Name" }`
5. Gallery auto-refreshes on next auth-triggered load or page reload

### Adding a Toast Notification

```tsx
import { useToast } from "../context/ToastContext";

const { toast } = useToast();

toast("Upload complete!", "success"); // green
toast("Something went wrong", "error"); // red
toast("See you soon ♥", "logout"); // blue (default)
```

Auto-dismisses after 1.5s. Three variants: `success`, `error`, `logout`.

---

## Common Pitfalls

### ❌ Storing gallery data outside GalleryContext

The context resets all data on logout. If you cache `imageMetas` in local component state, it will go stale after logout/re-login.

### ❌ Mounting another ImageModalViewer

There's already one global instance via `GalleryModalRenderer`. Mounting a second will cause duplicate backdrop, broken state.

### ❌ Calling Firebase directly

Always go through the service layer (`authService`, `storageService`) or context hooks (`useAuth`, `useGallery`). Direct Firebase calls bypass caching, normalization, and state management.

### ❌ Forgetting blob URL cleanup

Every `URL.createObjectURL` must have a matching `URL.revokeObjectURL`. Follow the existing pattern: revoke in effect cleanup or when replacing state.

### ❌ Using `new Date(isoString)` for display dates

ISO strings get UTC-shifted when parsed with `new Date()`. Use the `getLocalDate()` / `toLocalDate()` helpers that parse `YYYY-MM-DD` into local midnight to avoid off-by-one-day bugs.

### ❌ Hardcoding user-visible strings

All display strings should go through `src/config.ts` so the repo stays name-free for public visibility.

### ❌ Skipping `usePageReveal` on new pages

Every page should use the `usePageReveal` hook + the opacity/translate transition pattern for a consistent feel.

---

## Build & Development

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint check
npm run preview      # Preview production build locally
```

Required: Node 18+, `.env` file with Firebase credentials.
