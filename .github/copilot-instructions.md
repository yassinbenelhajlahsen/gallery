# Gallery — Copilot Instructions

> Before making changes, consult the detailed docs in `docs/` — they are the source of truth.
>
> | Doc                                        | Covers                                                                   |
> | ------------------------------------------ | ------------------------------------------------------------------------ |
> | [ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Provider hierarchy, routing, guards, directory map, env config           |
> | [DATA-FLOW.md](../docs/DATA-FLOW.md)       | Firebase → cache → context pipeline, loading sequence, memory management |
> | [COMPONENTS.md](../docs/COMPONENTS.md)     | Every component and page — props, behavior, usage examples               |
> | [CONVENTIONS.md](../docs/CONVENTIONS.md)   | Code patterns, styling rules, how-to guides, common pitfalls             |

## Build & Dev

- Node 18+. `npm install` → `npm run dev` → `npm run build` (runs `tsc -b` then Vite) → `npm run lint`.
- Environment lives in `.env` (git-ignored). Firebase creds as `VITE_FIREBASE_*`, display strings as `VITE_*` — see `src/config.ts` for all keys with defaults. Without Firebase creds, Auth/Storage calls fail at runtime.

## Architecture (quick ref)

- **Provider order matters:** `AuthProvider` → `GalleryProvider` → `ToastProvider` → `RomanticBackdrop` → `RouterProvider` + `GalleryModalRenderer`. Inner providers consume outer ones. Never mount providers inside a page.
- **Routing:** `createBrowserRouter` in `App.tsx`. Auth gating via `ProtectedRoute` / `GuestRoute`. The loading screen (`/loading`) redirects to `/home` once `hasGalleryLoadedOnce` flips true.
- **MainLayout** wraps all authenticated pages and provides `ScrollToTop`, `Navbar`, max-width `<main>`, and `Footer`.
- Pages live in `src/pages/*`, components in `src/components/*`, UI primitives in `src/components/ui/*`.

## Data & State

- **`storageService.ts`** is the only file that touches Firebase Storage. It fetches metadata from `images/full/`, resolves thumbnail URLs from `images/thumb/`, normalizes custom metadata (`date`/`Date`, `event`/`Event`, `caption`/`Caption`), and sorts newest-first.
- **`mediaCacheService.ts`** manages an IndexedDB cache with two stores: `image-blobs` (thumbnail blobs keyed by image ID) and `meta` (manifest). `syncCache` diffs fresh metadata against cached keys, downloads only new thumbnails in batches of 60, and evicts removed ones.
- **Videos & media:** The app now supports videos alongside images. `storageService.ts` exposes `fetchAllVideoMetadata()` and `getVideoDownloadUrl()` for videos stored under `videos/full/` (originals) and `videos/thumb/` (poster thumbnails). `mediaCacheService` also manages video poster caching (thumb JPEGs) via a separate sync path.
- **`GalleryContext`** owns `imageMetas`, `preloadedImages`, loading state, and modal state. It runs a three-phase load on auth: (1) instant restore from IndexedDB cache, (2) fetch fresh metadata from Firebase, (3) diff-sync cache. On logout, `resetState()` clears all state and wipes IndexedDB. Never store gallery data outside this context.
  The `GalleryContext` now also exposes `videoMetas`, `resolveVideoThumbUrl`, `openModalWithMedia`, and a unified `modalMedia` state (media can be images or videos).
- **`authService.ts`** wraps Firebase Auth with a hardcoded email from `config.authEmail`. Always go through `useAuth()` — never call Firebase Auth directly.
- **`useToast()`** exposes `toast(message, variant?)` with three variants: `"success"`, `"error"`, `"logout"` (default). Auto-dismisses after 1.5s.

## Modal

- One global `mediaModalViewer` is mounted via `GalleryModalRenderer` outside the router. **Never mount a second instance.**
- Open it via context: `openModalWithImages(images, opts?)`, `openModalWithMedia(media, opts?)` or `openModalForImageId(id, collection?)`.
- `OpenModalOptions`: `{ initialIndex?, imageId?, preloadAll? }`. Use `preloadAll: true` for small sets (e.g., timeline events). Note: `preloadAll` applies to image full-res preloading; videos are streamed on demand.
- The modal manages its own full-res blob URLs with windowed preloading (±10 ahead / ±5 behind) for images. It evicts outside the window.

## Image Resolution Pipeline

- **Upload:** Client-side JPEG conversion (quality 0.9) + thumbnail generation (480px, quality 0.7) → dual-write to `images/full/<name>.jpg` and `images/thumb/<name>.jpg` with `customMetadata: { date, event }`.
- **Display:** IndexedDB cached thumb blob → Firebase thumb URL fallback → `useFullResLoader` for full-res blob URLs. `HomePage` gates all rendering behind full-res readiness (no thumbnails shown). `All` uses progressive upgrade (thumb first, full-res overlaid). `ImageModalViewer` uses windowed full-res in the lightbox.
- **Display:** IndexedDB cached thumb blob → Firebase thumb URL fallback → `useFullResLoader` for full-res blob URLs. `HomePage` gates all rendering behind full-res readiness (no thumbnails shown). `All` uses progressive upgrade (thumb first, full-res overlaid). The media modal uses windowed full-res for images in the lightbox.
- **Video upload & display:** Video uploads write the original to `videos/full/` and a generated poster JPEG to `videos/thumb/`. The `UploaderPage` extracts a poster frame client-side and uploads it as the thumbnail. The lightbox (now a media-capable modal) will play videos on demand; video bytes are not prefetched during gallery load.
- **Memory:** Every `URL.createObjectURL` must have a matching `revokeObjectURL`. Follow existing cleanup patterns in effects, `evict()`, and `resetState()`.

## UI Conventions

- **Tailwind-first**, pastel palette. Core colors: `#FAFAF7` (bg), `#333` (text), `#F7DEE2` (pink), `#D8ECFF` (blue), `#FFE39F` (gold), `#F7889D` (heart).
- **Card pattern:** `rounded-[36px] bg-white/80 p-10 shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl`.
- **Page entrances:** Every page must use `usePageReveal(delay?)` and apply `isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"`.
- **Interactive elements:** `hover:scale-[1.03] active:scale-[0.98] touch-manipulation`.
- All user-facing strings come from `src/config.ts` (env-driven) — never hardcode personal text.

## Timeline & Events

- Events defined in `src/assets/events.json` with `{ id, date, title, emojiOrDot?, imageIds? }`.
- Images link to events two ways: explicit `imageIds` array OR matching `event` metadata (normalized, case-insensitive). Both are unioned.
- Keep `id` unique, `date` as `YYYY-MM-DD`. Events auto-sort newest-first in `TimelinePage`.

## Gallery Grouping

- `All` groups photos by year using local-date parsing (`getLocalDate`). Always use `YYYY-MM-DD` dates to avoid timezone-induced off-by-one grouping errors.
- Uses `IntersectionObserver` for visibility detection and preloads full-res for visible year-groups ± 3.
- `GalleryGrid` expects square tiles — configure via `columns` prop, don't modify the grid classes directly.

## Code Patterns

- Strict TypeScript, `type` imports, `satisfies` over `as`, no `any`.
- Functional components only. `useCallback`/`useMemo` for derived values. `useRef` for mutable non-reactive state.
- Async effects use cancellation flags: `let cancelled = false; return () => { cancelled = true; }`.
- Every effect that creates blob URLs, timers, or subscriptions must clean up.
