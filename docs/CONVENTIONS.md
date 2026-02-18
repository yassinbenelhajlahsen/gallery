# Conventions & How-To

> Project conventions and implementation recipes that match the current codebase.

## Code Conventions

### TypeScript

- `strict` mode enabled.
- Prefer explicit types and `type` imports.
- Avoid `any`; use narrowing from `unknown`.
- Use `satisfies` where object literal contracts matter.

### React

- Functional components only.
- Use `useMemo` / `useCallback` for derived values and callback props passed down.
- Effects with subscriptions/timers/object URLs must clean up.
- Async effect flows should include cancellation guards when race conditions are possible.

### Styling

- Tailwind-first.
- Existing UI language is soft pastel, rounded cards, blur/ring overlays.
- Keep interaction affordances (`hover` / `active` / keyboard focus) consistent.
- Respect `prefers-reduced-motion` patterns used in `src/index.css`.

### File Organization

- Pages: `src/pages`
- Reusable feature components: `src/components/*`
- UI primitives: `src/components/ui`
- State providers: `src/context`
- Backend wrappers: `src/services`
- Shared logic: `src/hooks`, `src/utils`, `src/types`

## Implementation Recipes

### Add a New Authenticated Page

1. Create page in `src/pages/NewPage.tsx`.
2. Use `usePageReveal()` for route entrance motion (same pattern as current pages).
3. Register route in `src/App.tsx` inside `RequireGalleryLoaded` branch (under `MainLayout` children).
4. Add navbar entry only if it should be globally navigable.

### Open the Global Modal

Use `useGallery()` helpers:

```tsx
const { openModalWithImages, openModalWithMedia, openModalForImageId } = useGallery();

openModalWithImages(images, { initialIndex: 0 });
openModalWithMedia(mixedMedia, { preloadAll: true });
openModalForImageId("photo-1.jpg", imageSubset);
```

Do not mount modal directly in pages.

### Build Gallery Tiles

Use `GalleryGrid` and compose tile data from context + `useFullResLoader`:

- image tiles: `url` = thumb (cached or network), `fullUrl` = resolved full URL
- video tiles: `url` = poster thumb, set `mediaType: "video"`, `durationSeconds`

### Upload Media Programmatically

Mirror `UploadTab` behavior:

1. Generate/upload image full + thumb OR video + poster.
2. Write Firestore metadata doc (`images` or `videos`) with storage paths and app metadata.
3. Keep metadata in Firestore, not Storage custom metadata.
4. Refresh gallery state after successful writes (`refreshGallery`).

### Create Timeline Events

Use Firestore `addDoc(collection(db, "events"), ...)` with:

- `date` (`YYYY-MM-DD`)
- `title`
- optional `emojiOrDot`
- optional `imageIds` (defaults empty)

Events are displayed newest-first.

## Common Pitfalls

### Direct Firebase calls from pages/components

Use service/context entrypoints so normalization, caching, and error handling remain centralized.

### Wrong date parsing

Avoid naive UTC-shifting display bugs. Follow existing local-date parsing helpers used in pages/modal.

### Duplicate modal instances

Only one global modal is expected (`GalleryModalRenderer`).

### Blob URL leaks

Any `URL.createObjectURL` must be paired with revoke logic.

### Assuming logout resets every gallery field

Current implementation clears media/cache/modal state on logout, but `events` is not cleared in `resetState()` (known behavior gap).

### Hardcoded personal strings

Put user-visible strings behind `src/config.ts` / `VITE_*`.

## Build & Run

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```
