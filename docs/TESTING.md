# Testing

> Current automated test setup and what it covers.

## Stack

- Vitest
- jsdom
- Testing Library (`@testing-library/react`, `@testing-library/jest-dom`)

## Commands

```bash
npm run test
npm run test:watch
```

## Test Setup

Global setup file: `src/test/setup.ts`

- enables `jest-dom` matchers
- runs `cleanup()` after each test
- provides jsdom shims used by pages/components (`scrollTo`, `IntersectionObserver`)

## Test Layout

- `src/test/app/` -> routing/guard behavior
- `src/test/e2e/` -> app-level happy-path integration
- `src/test/components/` -> component-level behavior
- `src/test/context/` -> provider lifecycle/state flows
- `src/test/hooks/` -> hook behavior
- `src/test/services/` -> service-layer logic
- `src/test/pages/` -> page-level behavior
- `src/test/utils/` -> standalone utility logic

## Current Coverage Snapshot

### `src/test/app/AppRouting.test.tsx`

- unauthenticated users are redirected to `/login`
- authenticated users with unloaded gallery are redirected to `/loading`
- authenticated users are redirected away from `/login`
- `/loading` redirects to `/home` once gallery is loaded

### `src/test/e2e/AppHappyPath.test.tsx`

- app-level happy-path flow in jsdom:
- authenticated app boot
- navigation across core pages (`/home`, `/photos`, `/videos`, `/timeline`)
- gallery/services load calls are exercised through the real route shell

### `src/test/components/admin/UploadTab.test.tsx`

- event creation success and failure paths
- metadata date inference behavior and event-date precedence
- image upload success path (Storage + Firestore + gallery refresh)
- duplicate-name collision suffix behavior
- fatal upload path when all files fail
- covers `UploadTab` integration with `src/services/uploadService.ts`

### `src/test/components/admin/DeleteTab.test.tsx`

- confirmation modal delete flow
- storage + Firestore delete wiring (image/video)
- event delete path including linked media field cleanup
- object-not-found tolerance for storage deletes
- search filtering behavior
- covers `DeleteTab` integration with `src/services/deleteService.ts`

### `src/test/components/gallery/mediaModalViewer.test.tsx`

- closed-state render behavior
- keyboard navigation (`ArrowRight`)
- dot navigation behavior
- close-on-escape timing behavior
- active video URL lazy loading

### `src/test/components/layout/ScrollToTop.test.tsx`

- scroll reset on mount/pathname changes

### `src/test/components/ui/FloatingInput.test.tsx`

- required/label/value interaction behavior
- error rendering behavior

### `src/test/context/AuthContext.test.tsx`

- `useAuth` guard outside provider
- provider state propagation + login/logout delegation

### `src/test/context/GalleryContext.test.tsx`

- load/refresh flows for images/videos/events
- auth reset behavior on user logout
- modal API contracts (`openModalWithImages`, `openModalWithMedia`, `openModalForImageId`)
- cached thumb URL resolution behavior
- error-path handling (`loadError`, video refresh fallback)

### `src/test/services/authService.test.ts`

- empty password validation
- sign-in call wiring to configured auth email
- auth state subscription delegation
- sign-out delegation

### `src/test/services/eventsService.test.ts`

- Firestore query wiring (`orderBy("date", "desc")`)
- doc-to-event mapping defaults
- permission-denied and non-permission error behavior

### `src/test/services/firebaseApp.test.ts`

- existing-app reuse branch
- initialize-new-app branch
- missing-required-env branch

### `src/test/services/mediaCacheService.test.ts`

- image cache sync/diff/progress behavior
- video thumb cache namespacing + eviction behavior
- full cache clear behavior

### `src/test/services/storageService.test.ts`

- image metadata sort + thumb fallback
- ISO/timestamp date normalization
- video metadata filtering + thumb fallback + duration normalization
- permission-denied error mapping

### `src/test/hooks/useFullResLoader.test.ts`

- full-res request, dedupe, resolve, and eviction behavior

### `src/test/hooks/usePageReveal.test.ts`

- delayed reveal behavior
- cleanup behavior on unmount

### `src/test/pages/HomePage.test.tsx`

- home tile flow + modal open behavior
- CTA navigation to `/photos`

### `src/test/pages/PhotosPage.test.tsx`

- full-res request/evict window behavior
- modal open behavior for clicked image

### `src/test/pages/TimelinePage.test.tsx`

- mixed-media union/dedupe behavior for timeline events
- modal open with `preloadAll` flow

### `src/test/pages/VideosPage.test.tsx`

- opens modal with full video collection at clicked item

### `src/test/pages/uploadMediaUtils.test.ts`

- video extension detection and normalization
- unsupported extension handling
- multi-dot filename support

### `src/test/utils/durationFormat.test.ts`

- `MM:SS` formatting behavior
- invalid input handling

### `src/test/utils/runtime.test.ts`

- low-bandwidth client detection (`innerWidth`, `navigator.connection.saveData`)

### `src/test/utils/uploadDateMetadata.test.ts`

- JPEG EXIF date extraction
- QuickTime/MP4 creation date extraction
- `lastModified` fallback
