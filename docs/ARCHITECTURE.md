# Architecture Overview

> Reference for how the app is actually wired today: provider boundaries, route guards, directory layout, and data contracts.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19 + TypeScript |
| Routing | `react-router-dom` v7 (`createBrowserRouter`) |
| Styling | Tailwind CSS v4 (PostCSS plugin) |
| Backend | Firebase Auth + Firestore + Storage |
| Caching | IndexedDB via `mediaCacheService` |
| Build | Vite + TypeScript project references (`tsc -b`) |
| Test | Vitest + Testing Library + jsdom |

## Directory Map

```text
src/
├── App.tsx
├── main.tsx
├── config.ts
├── index.css
│
├── components/
│   ├── admin/
│   │   ├── UploadTab.tsx
│   │   └── DeleteTab.tsx
│   ├── gallery/
│   │   ├── GalleryGrid.tsx
│   │   ├── GalleryModalRenderer.tsx
│   │   └── mediaModalViewer.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── ScrollToTop.tsx
│   ├── timeline/
│   │   └── TimelineEventItem.tsx
│   └── ui/
│       ├── FloatingInput.tsx
│       ├── DeleteConfirmModal.tsx
│       └── EditMetadataModal.tsx
│
├── context/
│   ├── AuthContext.tsx
│   ├── GalleryContext.tsx
│   └── ToastContext.tsx
│
├── hooks/
│   # cross-cutting
│   ├── usePageReveal.ts                  # route entrance motion
│   ├── useGalleryLoadingProgress.ts      # legacy / not used by main app shell
│   # full-res image resolution
│   ├── useFullResLoader.ts               # Photos/Home: windowed full-res URL resolver
│   ├── useFullResPreloader.ts            # mediaModalViewer: windowed full-res preload
│   # video prefetch
│   ├── useVideoPrefetch.ts               # modal video pool prefetch
│   ├── useVideoPagePrefetch.ts           # VideosPage poster prefetch
│   # UploadTab
│   ├── useEventCreation.ts               # event-creation form state + submit
│   ├── useUploadForm.ts                  # file picker + metadata/date/event state
│   ├── useUploadOrchestrator.ts          # upload queue + per-file progress
│   # DeleteTab (+ TimelinePage for useMediaSearch)
│   ├── useMediaSearch.ts                 # shared token-based search (images/videos/events)
│   ├── useMetadataEditor.ts              # edit draft state + save
│   ├── useDeleteConfirmation.ts          # delete confirmation flow
│   # mediaModalViewer
│   ├── useCarouselNavigation.ts          # indices, wrapping, slide transitions
│   ├── useModalViewportLock.ts           # body scroll lock + iOS navbar pinning
│   ├── useModalVideoManager.ts           # active video URL + cleanup
│   ├── useMediaSwipeGesture.ts           # touch handlers
│   # Photos/Videos grouping
│   └── useYearMonthGrouping.ts           # shared year→month bucketing (generic)
│
├── pages/
│   ├── LoginPage.tsx
│   ├── LoadingScreen.tsx
│   ├── HomePage.tsx
│   ├── TimelinePage.tsx
│   ├── PhotosPage.tsx
│   ├── VideosPage.tsx
│   ├── AdminPage.tsx
│   └── NotFoundPage.tsx
│
├── services/
│   ├── authService.ts
│   ├── deleteService.ts
│   ├── eventsService.ts
│   ├── storageService.ts
│   ├── mediaCacheService.ts
│   ├── uploadService.ts
│   ├── firebaseApp.ts
│   ├── firebaseAuth.ts
│   ├── firebaseFirestore.ts
│   └── firebaseStorage.ts
│
├── types/
│   ├── mediaTypes.ts
│   └── network-information.d.ts
│
└── utils/
    ├── uploadDateMetadata.ts
    ├── uploadMediaUtils.ts
    ├── durationFormat.ts
    └── runtime.ts
```

## Provider and Route Shell Hierarchy

`App.tsx` mounts only global app wrappers:

```text
<AuthProvider>
  <ToastProvider>
    <AppBackdrop>
      <RouterProvider />
    </AppBackdrop>
  </ToastProvider>
</AuthProvider>
```

`GalleryProvider` is route-scoped, not global. It is mounted only after auth is satisfied:

```text
RequireAuth
  -> GalleryAppShell
     -> <GalleryProvider>
          <Outlet />
          <GalleryModalRenderer />
```

Why this matters:

- Gallery state/caching logic does not run on `/login`.
- The modal renderer is global inside the authenticated shell (persists across nested route changes).
- `ToastProvider` is available on both login and authenticated routes.

## Routing and Guards

Router is defined in `src/App.tsx`.

| Path | Guard | Component | Notes |
| --- | --- | --- | --- |
| `/login` | `GuestRoute` | `LoginPage` | Authenticated users are redirected to `/loading` |
| `/ (shell)` | `RequireAuth` + `GalleryAppShell` | shell | Parent for all authenticated routes |
| `/loading` | auth-only shell child | `LoadingRoute` -> `LoadingScreen` | Redirects to `/` once gallery load flag is true |
| `/` | `RequireGalleryLoaded` + `MainLayout` | `HomePage` | Main landing page |
| `/home` | `RequireGalleryLoaded` + `MainLayout` | `Navigate` -> `/` | Backward-compatible home alias |
| `/timeline` | same as above | `TimelinePage` | Firestore events + mixed-media modal launch |
| `/photos` | same as above | `PhotosPage` | Photos grouped by year/month |
| `/videos` | same as above | `VideosPage` | Videos grouped by year/month |
| `/admin` | same as above | `AdminPage` | Tab via query string (`?tab=upload|delete`) |
| `*` | same as above | `NotFoundPage` | Catch-all |

Guard behavior summary:

- `RequireAuth`: blocks unauthenticated users.
- `GuestRoute`: blocks authenticated users from login page.
- `RequireGalleryLoaded`: forces authenticated users through loading route before main pages.

## Main Layout

Authenticated content pages render inside `MainLayout`, which provides:

- `ScrollToTop`
- `Navbar`
- centered `<main>` container
- `Footer` (admin entry)

## Hook Composition

Feature-heavy components delegate their non-UI logic to hooks in `src/hooks/`:

- `UploadTab` → `useEventCreation`, `useUploadForm`, `useUploadOrchestrator`
- `DeleteTab` → `useMediaSearch`, `useMetadataEditor`, `useDeleteConfirmation`
- `mediaModalViewer` → `useCarouselNavigation`, `useModalViewportLock`, `useModalVideoManager`, `useFullResPreloader`, `useMediaSwipeGesture`
- `TimelinePage` → `useMediaSearch` (shared with DeleteTab)
- `PhotosPage` + `VideosPage` → `useYearMonthGrouping` (generic)

Components keep render/layout/wiring only; state, effects, and async orchestration live in hooks. Refs owned by DOM are created in the component and passed into hooks as parameters (never returned from hooks — `eslint-plugin-react-hooks` v7 flags that).

## Admin Module Split

Admin UI and data operations are split across components and services:

- `src/components/admin/UploadTab.tsx`: upload/event forms, progress UI, and orchestration.
- `src/services/uploadService.ts`: media conversion/extraction helpers, Storage uploads, Firestore writes, and unique-name resolution.
- `src/components/admin/DeleteTab.tsx`: search/filter UI and delete/edit orchestration.
- `src/components/ui/DeleteConfirmModal.tsx`: reusable admin delete confirmation modal UI.
- `src/services/deleteService.ts`: metadata update helpers, Storage deletes, Firestore deletes, and linked event/media cleanup.

## Environment Configuration

Firebase credentials are required and read in `src/services/firebaseApp.ts`:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Auth UX also requires:

```text
VITE_AUTH_EMAIL
```

User-facing text defaults are in `src/config.ts` and can be overridden with:

```text
VITE_BRAND_DISPLAY
VITE_SITE_TITLE
VITE_SITE_DESCRIPTION
VITE_LOGIN_HEADING
VITE_NOT_FOUND_TEXT
```

Note: `.env.example` also includes `measurementId`, but it is currently unused by app code.

## Data Model (Firestore + Storage)

### Storage paths

```text
images/full/<id>.jpg
images/thumb/<id>.jpg
videos/full/<id>.mp4|.mov
videos/thumb/<basename>.jpg
```

### Firestore collections

`images/<id>`

- `id`
- `type: "image"`
- `date` (normalized to date-like string)
- `event?`, `caption?`
- `fullPath`, `thumbPath`
- `createdAt`

`videos/<id>`

- `id`
- `type: "video"`
- `date`
- `event?`, `caption?`
- `videoPath`, `thumbPath`
- `durationSeconds?`
- `createdAt`

`events/<docId>`

- `date` (`YYYY-MM-DD` expected)
- `title`
- `emojiOrDot?`
- `imageIds?` (can include image ids and video ids)
- `createdAt?`

## Agent-Critical Notes

- Use direct Firebase module imports (`firebaseApp`, `firebaseAuth`, `firebaseFirestore`, `firebaseStorage`) for all new code.
- `GalleryContext.resetState()` clears all gallery state when the user becomes unauthenticated: images, videos, events, modal state, progress state, and IndexedDB cache.
