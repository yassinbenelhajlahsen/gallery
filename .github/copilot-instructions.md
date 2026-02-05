# rasso-gallery — Copilot Instructions

## Build & Local Workflows

- Use Node 18+; install deps once with `npm install`, develop with `npm run dev`, ship using `npm run build` (runs `tsc -b` before Vite) and lint via `npm run lint`.
- Environment lives in `.env`; provide Firebase creds as `VITE_FIREBASE_*` (see `src/services/firebaseConfig.ts`). Without them, Firebase Auth/Storage calls fail at runtime.

## High-Level Architecture

- `src/App.tsx` wires the route graph through `createBrowserRouter`, wraps everything in `AuthProvider` + `GalleryProvider`, and renders the ambient `RomanticBackdrop` + `GalleryModalRenderer` so every page can trigger the modal.
- Auth gating happens via `ProtectedRoute`/`GuestRoute`; the loading screen (`/loading`) is only shown until `GalleryContext.hasGalleryLoadedOnce` flips true. Respect these guards when adding routes.
- Pages live in `src/pages/*` and assume the providers are already mounted; stick to that folder unless you’re building smaller presentational pieces for `src/components/*`.

## Data, Firebase & Preloading

- `src/services/authService.ts` hardcodes the login email and exposes `signInWithPassword`, `signOut`, and `subscribeToAuthChanges`; always go through `useAuth()` instead of calling Firebase directly.
- `src/services/storageService.ts` is the only place that should touch Firebase Storage. It sorts metadata newest-first, normalizes custom metadata (`date`, `event`, `caption`), and can `preloadImages` to Blob URLs; reuse `resolveImageUrl` from `useGallery()` to benefit from caching.
- `GalleryContext` owns `imageMetas`, `preloadedImages`, modal state, and exposes helpers like `openModalWithImages`, `openModalForImageId`, and `resolveImageUrl`. Do not duplicate modal or preload logic elsewhere; call the context instead.
- Logging out or losing auth automatically resets gallery state (see `resetState()` in the provider). Avoid storing gallery data outside the context, otherwise you’ll fight that reset behavior.

## UI & Interaction Patterns

- Styling is Tailwind-first with a pastel theme; keep class-heavy components declarative and reference `spec/design.md` for color, motion, and spacing rules.
- Page-level entrances use `usePageReveal(delay?)` for smooth fade/slide transitions; new pages should follow the pattern from `HomePage.tsx` or `SeeAllGalleryPage.tsx`.
- The global modal is implemented in `ImageModalViewer.tsx` and expects images + optional `resolveImageUrl`. When you need a lightbox, feed it via the gallery context instead of mounting another modal.

## Timeline, Gallery & Content Sources

- Timeline events are defined in `src/assets/events.json`, sorted newest-first in `TimelinePage.tsx`, and linked to images by either explicit `imageIds` or matching `event` labels. Keep IDs unique and update the JSON when you add events.
- The "See All" view groups photos by year using `getLocalDate` helpers inside `SeeAllGalleryPage.tsx`. Ensure new metadata includes valid ISO dates so grouping stays correct.
- `GalleryGrid.tsx` expects square-ish tiles. Supply `columns` overrides instead of changing the grid utility classes in-place.

## Uploading & Metadata Hygiene

- `UploaderPage.tsx` converts every selected file to JPEG client-side, enforces a YYYY-MM-DD `date`, and writes metadata as Firebase Storage `customMetadata`. If you change storage structure, update both the uploader and `storageService` so metadata stays in sync.
- Storage paths are normalized to `images/<filename>.jpg`; avoid embedding folders elsewhere unless you teach `IMAGES_ROOT` how to discover them.

## Reference Docs

- The `spec/` folder (design, product, pages, technical) documents intent behind transitions, grouping rules, and non-functional goals—consult it before adjusting UX or data flows.
