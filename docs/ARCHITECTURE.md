# Architecture Overview

> Quick-reference for agents and developers to understand the app's structure, provider hierarchy, routing, and file organization.

## Tech Stack

| Layer     | Technology                                                    |
| --------- | ------------------------------------------------------------- |
| Framework | React 19 + TypeScript                                         |
| Routing   | react-router-dom v7 (`createBrowserRouter`)                   |
| Styling   | Tailwind CSS v4 (PostCSS plugin)                              |
| Backend   | Firebase Auth (email/password) + Firebase Storage + Firestore |
| Caching   | IndexedDB via custom `mediaCacheService`                      |
| Build     | Vite + `tsc -b` (see `npm run build`)                         |

## Directory Map

```
src/
├── App.tsx                     # Root: provider tree + router + backdrop
├── config.ts                   # All env-driven strings (VITE_*)
├── main.tsx                    # ReactDOM entry
├── index.css                   # Tailwind directives + global styles
│
│
├── components/
│   ├── Footer.tsx              # Site-wide footer
│   ├── GalleryGrid.tsx         # Responsive grid of square tiles (reusable)
│   ├── GalleryModalRenderer.tsx# Mounts mediaModalViewer from GalleryContext
│   ├── mediaModalViewer.tsx    # Full-screen lightbox that supports images & videos
│   ├── Navbar.tsx              # Sticky top nav with route links + logout
│   ├── ScrollToTop.tsx         # Scroll-to-top on route change
│   ├── TimelineEventItem.tsx   # Single event row for the timeline
│   └── ui/
│       └── FloatingInput.tsx   # Reusable floating-label input
│
├── context/
│   ├── AuthContext.tsx          # Auth state + login/logout
│   ├── GalleryContext.tsx       # Image metas, events, preloading, modal state
│   └── ToastContext.tsx         # Toast notification system
│
├── hooks/
│   ├── useFullResLoader.ts     # On-demand full-res blob URL loader
│   ├── useGalleryLoadingProgress.ts  # (Legacy) standalone loading hook
│   └── usePageReveal.ts        # Fade/slide entrance transition flag
│
├── pages/
│   ├── HomePage.tsx            # Random photo grid + hero
│   ├── LoadingScreen.tsx       # Shown until gallery first loads
│   ├── LoginPage.tsx           # Password-only login
│   ├── NotFoundPage.tsx        # 404 page
│   ├── PhotosPage.tsx          # Alias/entry for the All photos page (route: /photos)
│   ├── VideosPage.tsx          # Videos gallery page (groups videos by year)
│   ├── TimelinePage.tsx        # Chronological event list
│   └── UploaderPage.tsx        # Client-side JPEG conversion + upload + event creation
│
└── services/
    ├── authService.ts           # Firebase Auth wrapper
    ├── eventsService.ts         # Firestore events: fetch/create operations
    ├── firebaseConfig.ts        # Firebase app init + exports (Auth, Storage, Firestore)
    ├── mediaCacheService.ts     # IndexedDB cache (thumbnails + manifest)
    └── storageService.ts        # Firebase Storage: metadata fetch + types
```

## Provider Hierarchy

Providers wrap the entire app in `App.tsx`. **Order matters** — inner providers can consume outer ones.

```
<AuthProvider>                   ← Firebase Auth state
  <GalleryProvider>              ← Image data, preloading, modal state (consumes useAuth)
    <ToastProvider>              ← Toast notifications
      <RomanticBackdrop>         ← Visual wrapper (floating hearts, gradients)
        <RouterProvider />       ← Route tree
        <GalleryModalRenderer /> ← Global lightbox (reads GalleryContext)
      </RomanticBackdrop>
    </ToastProvider>
  </GalleryProvider>
</AuthProvider>
```

### Key Implications

- `GalleryProvider` subscribes to `useAuth()`. When the user logs out, it calls `resetState()` which clears all image data **and** wipes the IndexedDB cache.
- `GalleryModalRenderer` is mounted **outside** the router so the lightbox persists across route transitions.
- Pages assume all three providers are already mounted — never mount providers inside a page.

## Routing & Auth Guards

The router is a flat `createBrowserRouter` array defined in `App.tsx`.

### Route Table

| Path        | Guard            | Component       | Notes                                         |
| ----------- | ---------------- | --------------- | --------------------------------------------- |
| `/login`    | `GuestRoute`     | `LoginPage`     | Redirects to `/home` or `/loading` if authed  |
| `/loading`  | `ProtectedRoute` | `LoadingScreen` | Redirects to `/home` once gallery loads       |
| `/`         | `ProtectedRoute` | `MainLayout`    | Requires auth + `hasGalleryLoadedOnce`        |
| `/home`     | (nested)         | `HomePage`      | Random photo grid                             |
| `/timeline` | (nested)         | `TimelinePage`  | Event list from Firestore `events` collection |
| `/photos`   | (nested)         | `All`           | All photos grouped by year (route `/photos`)  |
| `/videos`   | (nested)         | `VideosPage`    | Videos gallery (route `/videos`)              |
| `/upload`   | (nested)         | `UploaderPage`  | Photo upload form + event creation            |
| `*`         | —                | `NotFoundPage`  | 404 catch-all                                 |

### Guard Components

- **`ProtectedRoute`** — Requires `user` from `useAuth()`. Optional props:
  - `requireGalleryLoaded` — if true, redirects to `/loading` until `hasGalleryLoadedOnce` is true.
  - `redirectIfGalleryReadyTo` — if set and gallery IS loaded, redirects (used by `/loading` to bounce to `/home`).
- **`GuestRoute`** — Requires NO `user`. If authed, redirects to `/home` (or `/loading` if gallery not ready).

### MainLayout

All authenticated pages render inside `MainLayout`, which provides:

- `<ScrollToTop />` — resets scroll on route change
- `<Navbar />` — sticky top navigation
- `<main>` wrapper with max-width container
- `<Footer />`

## Environment Configuration

All user-visible strings live in `src/config.ts`, sourced from `VITE_*` env vars. Firebase credentials are also env-driven via `src/services/firebaseConfig.ts`.

Required env vars for Firebase:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_AUTH_EMAIL
```

Optional display strings (see `config.ts` for defaults):

```
VITE_COUPLE_DISPLAY, VITE_SITE_TITLE, VITE_SITE_DESCRIPTION,
VITE_LOGIN_HEADING, VITE_LOGOUT_TOAST,
VITE_NOT_FOUND_TEXT
```

## Firebase Storage Layout

```
images/
├── full/    ← Original/full-resolution JPEGs
│   ├── photo1.jpg
│   └── photo2.jpg
└── thumb/   ← 480px thumbnails (generated client-side on upload)
    ├── photo1.jpg
    └── photo2.jpg

videos/
├── full/    ← Original video files
│   ├── video1.mp4
│   └── video2.mov
└── thumb/   ← Generated poster JPEGs (first frame or custom)
    ├── video1.jpg
    └── video2.jpg
```

- The uploader writes both `images/full/` and `images/thumb/` variants for photos, and `videos/full/` + `videos/thumb/` for videos.
- `storageService.ts` reads from `full/` directories for metadata + download URLs, and resolves `thumb/` URLs as fallbacks.
- Media metadata (`date`, `event`, `caption`) is stored on Firestore docs (`images` / `videos`) and read by `storageService.ts`.
- Video thumbnails are generated client-side (first frame extraction) and uploaded as JPEG posters.
