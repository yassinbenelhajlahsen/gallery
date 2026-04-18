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
- Use the `font-display` Tailwind utility (`--font-display: "Instrument Serif", Georgia, serif`) for page-level headings; it is declared in `src/index.css` and loaded via Google Fonts in `index.html`.

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

1. Prefer `src/services/uploadService.ts` entrypoints (`uploadImageWithMetadata`, `uploadVideoWithMetadata`) instead of in-component Firebase logic. Both accept an optional `onProgress: (fraction: number) => void` callback that reports combined full+thumb byte progress via `uploadBytesResumable`.
2. Generate/upload image full + thumb OR video + poster.
3. Write Firestore metadata doc (`images` or `videos`) with storage paths and app metadata.
4. Keep metadata in Firestore, not Storage custom metadata.
5. For batch uploads, run a bounded worker pool (3 concurrent by default — see `useUploadOrchestrator`) rather than a sequential loop.
6. Call `refreshGallery()` **once** after the whole batch completes — newly uploaded thumbs need the IndexedDB cache sync. Individual uploads don't need a refresh on their own.

### Delete or Edit Metadata Programmatically

Mirror `DeleteTab` behavior via `src/services/deleteService.ts`:

1. For media metadata edits, use `updateMediaMetadata(kind, id, date, event, location?)`. The optional `location` argument follows a three-state contract: `undefined` leaves the field alone, `null` clears it, an object sets it. Diff against the original on the caller side (see `useMetadataEditor.saveEdit`) so untouched edits don't cause spurious writes.
2. For timeline event edits, use `updateTimelineEventMetadata(...)` so linked media is updated on title changes. The service no longer requires a `mediaIds` parameter — the `where("event","==",oldTitle)` batch covers every linked doc.
3. For destructive operations, use `deleteImageWithMetadata(...)`, `deleteVideoWithMetadata(...)`, or `deleteEventWithLinkedMediaCleanup(eventId, eventTitle)`.
4. **Do not** call `refreshGallery()` / `refreshEvents()` after a single mutation. Instead, patch `GalleryContext` state directly via `patchImageMeta` / `removeImageMeta` / `patchVideoMeta` / `removeVideoMeta` / `patchEvent` / `removeEvent` / `upsertEvent`. Every page (Photos, Videos, Timeline, DeleteTab) reads the same context state, so patches propagate everywhere in one render with no Firestore round-trip or loading flicker. Reserve full refreshes for the post-upload case, where thumb cache sync is required.

### Extract Component Logic into Hooks

When a page/component grows past ~300 lines or mixes unrelated concerns, split non-UI logic into hooks under `src/hooks/`. Existing decompositions to mirror:

- `UploadTab` → `useEventCreation`, `useUploadForm`, `useUploadOrchestrator`
- `DeleteTab` → `useMediaSearch`, `useMetadataEditor`, `useDeleteConfirmation`
- `mediaModalViewer` → `useCarouselNavigation`, `useModalViewportLock`, `useModalVideoManager`, `useFullResPreloader`, `useMediaSwipeGesture`

Rules:

1. **Component owns DOM refs.** Create the ref in the component with `useRef(null)`, pass it into hooks that need DOM access, and use it directly in JSX. Hooks must not return refs — `eslint-plugin-react-hooks` v7's `react-hooks/refs` rule flags that and poisons every property of the returned object.
2. **Prefer `useCallback` deps over refs.** Capture the latest value via the dep array rather than threading a `useRef` for "latest value" snapshots.
3. **Cancellation tokens for async effects.** Use the `let cancelled = false` pattern (see `useModalVideoManager`, `useUploadForm`) to guard async completions.
4. **Keep shared hooks generic.** `useYearMonthGrouping<T extends { date: string }>`, `useMediaSearch` hitting `useGallery()` — favor these over duplicating logic across pages.

### Create Timeline Events

Prefer `createTimelineEvent(...)` from `src/services/uploadService.ts`.

Event payload shape:

- `date` (`YYYY-MM-DD`)
- `title`
- optional `emojiOrDot`
- optional `imageIds` (defaults empty)

Events are displayed newest-first.

## Common Pitfalls

### Direct Firebase calls from pages/components

Use service/context entrypoints so normalization, linked-cleanup logic, caching, and error handling remain centralized.

### Wrong date parsing

Avoid naive UTC-shifting display bugs. Follow existing local-date parsing helpers used in pages/modal.

### Duplicate modal instances

Only one global modal is expected (`GalleryModalRenderer`).

### Blob URL leaks

Any `URL.createObjectURL` must be paired with revoke logic.

### Hardcoded personal strings

Put user-visible strings behind `src/config.ts` / `VITE_*`.

### Map & Geocoding

- Map tiles come from CartoDB Positron (`https://{s}.basemaps.cartocdn.com/light_all/...`) — free, attribution-only, no API key. They are runtime-cached by the service worker under `map-tiles-cache` (see `vite.config.ts`).
- Address search uses Nominatim (`nominatim.openstreetmap.org/search`) — no key, 1 req/sec fair-use cap. Always debounce (≥400ms) and abort stale requests with `AbortController`. If usage ever scales beyond a single admin, swap to a paid geocoder (Mapbox free tier) or self-host Nominatim.
- Leaflet creates its own stacking context with panes in the 400–700 z-index range. When rendering overlays (popover menus, dropdowns) next to a map, wrap the map container in an element with an explicit `z-index` (e.g. `z-0`) so its panes can't beat sibling overlay content.
