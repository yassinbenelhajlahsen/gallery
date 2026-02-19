# AGENTS.md

## Project Snapshot
- Stack: React 19 + TypeScript + Vite + Tailwind CSS v4 + Firebase (Auth/Firestore/Storage).
- App type: private authenticated gallery with photos, videos, timeline events, and admin upload/delete tools.
- Entry points: `src/main.tsx`, `src/App.tsx`.

## Verified Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Unit/integration tests: `npm run test`
- Watch tests: `npm run test:watch`
- Production build: `npm run build`
- Build + bundle analyzer output (`dist/stats.html`): `npm run build:analyze`
- Preview build: `npm run preview`
- CI install: `npm ci`

## Environment Requirements
- Required Firebase env vars are enforced at runtime in `src/services/firebaseApp.ts`:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- Auth flow also depends on `VITE_AUTH_EMAIL` (used by `authService` sign-in).
- Optional branding/user-facing text is in `src/config.ts` via `VITE_*` vars.
- `.env` is gitignored; `.env.example` is the template.

## Architecture (Current)
- Global providers in `App.tsx`:
  - `AuthProvider -> ToastProvider -> RomanticBackdrop -> RouterProvider`
- Authenticated route shell:
  - `RequireAuth -> GalleryProvider -> Outlet + GalleryModalRenderer`
- Route gates:
  - `/login`: guest-only
  - `/loading`: auth-only loading gate
  - `/home`, `/photos`, `/videos`, `/timeline`, `/admin`: require gallery loaded
- `GalleryProvider` owns:
  - image/video metadata
  - IndexedDB-backed thumbnail cache hydration/sync
  - events list
  - modal state

## Data Model and Storage
- Firestore collections:
  - `images`
  - `videos`
  - `events`
- Firebase Storage paths:
  - `images/full/<id>.jpg`
  - `images/thumb/<id>.jpg`
  - `videos/full/<id>.mp4|.mov`
  - `videos/thumb/<basename>.jpg`
- Metadata source of truth is Firestore (not Storage custom metadata).

## Key Service Boundaries
- `authService`: login/logout/auth subscription wrapper.
- `storageService`: fetch image/video metadata + resolve video download URL on demand.
- `eventsService`: ordered event fetch.
- `mediaCacheService`: IndexedDB cache for image thumbs + namespaced video thumbs (`video:<id>`).
- `uploadService`: event creation + image/video upload pipelines + unique-name resolution.
- `deleteService`: metadata edits + media/event deletes + linked cleanup.

## Constraints and Gotchas
- Video uploads/support are extension-based and limited to `.mp4` and `.mov` (`uploadMediaUtils`, `uploadService`).
- Timeline media matching is union-based:
  - explicit `event.imageIds`
  - normalized title match against media `event` field.
- Only one modal instance is expected; use `GalleryContext` modal APIs, not page-level modal mounts.
- `GalleryContext.resetState()` clears media/cache/modal state but does not clear `events`.
- Date handling intentionally normalizes/parses local date-like values in multiple modules (`storageService`, pages, `deleteService`); preserve this behavior to avoid timezone shifts.
- `ScrollToTop` uses `window.scrollTo({ behavior: "instant" })`.
- `/upload` is a redirect route to `/admin?tab=upload`.
- `useGalleryLoadingProgress` exists but app loading uses `GalleryContext.loadingProgress`.
- `cors.json` has `Content-Tyxpe` typo in `responseHeader` (current file value).

## Build/Test/Config Notes
- TypeScript project references: `tsconfig.json` -> `tsconfig.app.json` + `tsconfig.node.json`.
- Strict TS is enabled; linting includes `noUnusedLocals`/`noUnusedParameters`.
- Vitest config:
  - environment: `jsdom`
  - setup: `src/test/setup.ts`
  - include: `src/**/*.test.ts` and `src/**/*.test.tsx`
- Vite build defines manual chunks for Firebase/Auth/Firestore/Storage/router/react vendor splits.

## CI and PR Rules (Detected)
- Workflows:
  - `.github/workflows/firebase-hosting-pull-request.yml`
  - `.github/workflows/firebase-hosting-merge.yml`
- Both CI flows run: `npm ci`, `npm run lint`, `npm run test`, `npm run build`.
- PR preview deploy is conditional: runs only for same-repo PRs (`if: github.event.pull_request.head.repo.full_name == github.repository`).
- Trigger ignore rules in both workflows:
  - `docs/**`
  - `**/*.md`
  - `.gitignore`
- Merge deploy triggers on push to `main` (plus manual dispatch).
- No PR template or explicit contribution guide was detected in-repo.

## Security/Repo Hygiene Observations
- `serviceAccountKey.json` and `.env` are gitignored; keep credentials out of commits.
