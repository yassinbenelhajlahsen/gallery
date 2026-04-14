# CLAUDE.md

Private authenticated photo/video gallery — React 19 + TypeScript + Vite + Tailwind CSS v4 + Firebase (Auth/Firestore/Storage). Single-user owner-only access. Entry points: `src/main.tsx`, `src/App.tsx`.

## Commands

```bash
npm run dev          # vite dev server
npm run verify       # lint + test + build (CI runs this on PRs + push to main)
npm run test:watch   # vitest watch
npx vitest run src/test/path/to/file.test.tsx   # single test file
```

CI trigger-ignores `docs/**` and `**/*.md`.

## Project Structure

- `src/pages/` — route components (Login, Loading, Home, Photos, Videos, Timeline, Admin, NotFound)
- `src/components/{admin,gallery,layout,timeline,ui}/`
- `src/context/` — `AuthContext`, `GalleryContext`, `ToastContext`
- `src/services/` — Firebase wrappers: `authService`, `storageService`, `eventsService`, `mediaCacheService`, `uploadService`, `deleteService`
- `src/hooks/`, `src/utils/`, `src/types/`, `src/config.ts`
- `docs/` — reference docs (see below)

## Conventions

- **YOU MUST** route Firebase access through `src/services/*` and context hooks (`useAuth`, `useGallery`). No ad-hoc Firebase calls from pages/components.
- **IMPORTANT:** One global modal only (`GalleryModalRenderer` in the authenticated shell). Open it via `useGallery()` helpers — never mount a second instance.
- **IMPORTANT:** Local date parsing in `storageService`, pages, and `deleteService` is intentional. Do not "fix" it to UTC — it prevents timezone drift.
- User-facing strings come from `src/config.ts` / `VITE_*` env vars. No hardcoded personal text.
- Video uploads are extension-restricted to `.mp4` / `.mov` (`src/utils/uploadMediaUtils.ts`).

## Reference Docs

| Doc | Read when |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | touching routing, providers, guards, directory layout, or Firestore/Storage schema |
| [docs/DATA-FLOW.md](docs/DATA-FLOW.md) | modifying a service, `GalleryContext` lifecycle, IndexedDB cache, or modal state flow |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | editing pages/components or adding a new one |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | adding a page, opening the modal, programmatic upload/delete, or creating timeline events |
| [docs/SETUP.md](docs/SETUP.md) | configuring Firebase env vars, security rules, or local run |
| [docs/TESTING.md](docs/TESTING.md) | writing/running tests, vitest/jsdom setup |
