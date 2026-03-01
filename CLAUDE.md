# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Private authenticated photo/video gallery — React 19 + TypeScript + Vite + Tailwind CSS v4 + Firebase (Auth/Firestore/Storage). Single-user owner-only access. Entry points: `src/main.tsx`, `src/App.tsx`.

## Commands

```bash
npm install          # install dependencies
npm run dev          # vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run test         # vitest run
npm run test:watch   # vitest in watch mode
npm run verify       # lint + test + build (CI uses this)
npx vitest run src/test/path/to/file.test.tsx  # run a single test file
```

CI runs `npm run verify` (lint → test → build) on every PR and push to main. Docs and markdown changes are excluded from CI triggers.

## Architecture

### Provider hierarchy (defined in `App.tsx`)

```
AuthProvider → ToastProvider → RomanticBackdrop → RouterProvider
                                                    └─ RequireAuth
                                                         └─ GalleryProvider → Outlet + GalleryModalRenderer
```

- `GalleryProvider` is route-scoped (authenticated shell only), not global.
- One global modal instance (`GalleryModalRenderer`) — never mount another.
- `ToastProvider` is available on both login and authenticated routes.

### Routing and guards

Router uses `createBrowserRouter` in `src/App.tsx`. Guard chain:
- `GuestRoute` — blocks authenticated users from `/login`
- `RequireAuth` — blocks unauthenticated users
- `RequireGalleryLoaded` — forces users through `/loading` before content pages

Content pages (`/`, `/photos`, `/videos`, `/timeline`, `/admin`) render inside `MainLayout` (Navbar + Footer + ScrollToTop).

### Data model

**Firestore** is the metadata source of truth (not Storage custom metadata):
- `images/<id>` — image metadata with `fullPath`, `thumbPath`
- `videos/<id>` — video metadata with `videoPath`, `thumbPath`, optional `durationSeconds`
- `events/<docId>` — timeline events with `date` (YYYY-MM-DD), `title`, optional `imageIds`

**Storage paths:** `images/full/<id>.jpg`, `images/thumb/<id>.jpg`, `videos/full/<id>.mp4|.mov`, `videos/thumb/<basename>.jpg`

**IndexedDB cache** (`mediaCacheService`): thumbnails keyed by image id or `video:<id>`.

### Service layer (`src/services/`)

Use service wrappers and context hooks (`useAuth`, `useGallery`) — never make ad-hoc Firebase calls from pages/components.

- `authService` — login/logout/subscription
- `storageService` — fetch image/video metadata, resolve download URLs
- `eventsService` — ordered event fetch
- `mediaCacheService` — IndexedDB cache for thumbnails
- `uploadService` — image/video upload pipelines, event creation, unique-name resolution
- `deleteService` — metadata edits, media/event deletes, linked cleanup

Prefer direct Firebase modules (`firebaseApp`/`firebaseAuth`/`firebaseFirestore`/`firebaseStorage`) over `firebaseConfig.ts` in new code.

## Key Conventions

- **TypeScript strict mode** with `noUnusedLocals`/`noUnusedParameters` enforced.
- **Functional components only.** Use `useMemo`/`useCallback` for derived values and callback props.
- **Tailwind-first styling.** UI language: soft pastel, rounded cards, blur/ring overlays. Respect `prefers-reduced-motion`.
- **User-facing strings** go through `src/config.ts` / `VITE_*` env vars — no hardcoded personal text.
- **Local date parsing** is intentional across `storageService`, pages, and `deleteService` to avoid timezone shifts — preserve this pattern.
- **Effects with subscriptions/timers/object URLs** must clean up. Async effects need cancellation guards.
- **Blob URLs** from `URL.createObjectURL` must be paired with revoke logic.
- New pages: create in `src/pages/`, use `usePageReveal()`, register in `App.tsx` under `RequireGalleryLoaded`/`MainLayout`.
- Open modal via `useGallery()` helpers (`openModalWithImages`, `openModalWithMedia`, `openModalForImageId`).
- Video uploads limited to `.mp4` and `.mov`.

## Environment

Required env vars (validated at runtime in `firebaseApp.ts`):
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_AUTH_EMAIL`

Optional branding overrides in `src/config.ts`: `VITE_COUPLE_DISPLAY`, `VITE_SITE_TITLE`, `VITE_SITE_DESCRIPTION`, `VITE_LOGIN_HEADING`, `VITE_LOGOUT_TOAST`, `VITE_NOT_FOUND_TEXT`

Template: `.env.example`. `.env` and `serviceAccountKey.json` are gitignored.

## Testing

Vitest + Testing Library + jsdom. Setup: `src/test/setup.ts`. Tests live under `src/test/` mirroring the source structure (`app/`, `components/`, `context/`, `hooks/`, `pages/`, `services/`, `utils/`).

## Additional Docs

Detailed reference docs live in `docs/`: `ARCHITECTURE.md`, `DATA-FLOW.md`, `COMPONENTS.md`, `CONVENTIONS.md`, `SETUP.md`, `TESTING.md`.
