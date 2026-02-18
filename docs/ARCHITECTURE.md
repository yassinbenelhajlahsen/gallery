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
│       └── FloatingInput.tsx
│
├── context/
│   ├── AuthContext.tsx
│   ├── GalleryContext.tsx
│   └── ToastContext.tsx
│
├── hooks/
│   ├── useFullResLoader.ts
│   ├── usePageReveal.ts
│   └── useGalleryLoadingProgress.ts   # legacy / not used by main app shell
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
│   ├── eventsService.ts
│   ├── storageService.ts
│   ├── mediaCacheService.ts
│   ├── firebaseApp.ts
│   ├── firebaseAuth.ts
│   ├── firebaseFirestore.ts
│   ├── firebaseStorage.ts
│   └── firebaseConfig.ts   # compatibility barrel
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
    <RomanticBackdrop>
      <RouterProvider />
    </RomanticBackdrop>
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
| `/` | `RequireAuth` + `GalleryAppShell` | shell | Parent for all authenticated routes |
| `/loading` | auth-only shell child | `LoadingRoute` -> `LoadingScreen` | Redirects to `/home` once gallery load flag is true |
| `/home` | `RequireGalleryLoaded` + `MainLayout` | `HomePage` | Main landing page |
| `/timeline` | same as above | `TimelinePage` | Firestore events + mixed-media modal launch |
| `/photos` | same as above | `PhotosPage` | Photos grouped by year/month |
| `/videos` | same as above | `VideosPage` | Videos grouped by year/month |
| `/admin` | same as above | lazy `AdminPage` | Tab via query string (`?tab=upload|delete`) |
| `/upload` | same as above | redirect | Legacy redirect to `/admin?tab=upload` |
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
- `Footer` (admin entry + logout)

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
VITE_COUPLE_DISPLAY
VITE_SITE_TITLE
VITE_SITE_DESCRIPTION
VITE_LOGIN_HEADING
VITE_LOGOUT_TOAST
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

- Prefer direct Firebase modules (`firebaseApp/firebaseAuth/firebaseFirestore/firebaseStorage`) over `firebaseConfig.ts` in new code.
- `GalleryContext.resetState()` currently clears images/videos/modal/cache but does **not** clear `events` state; treat this as a known behavior gap when debugging logout edge cases.
