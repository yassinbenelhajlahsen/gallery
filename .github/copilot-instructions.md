# Gallery — Copilot Instructions

Use the docs in `docs/` as source of truth:

- `docs/ARCHITECTURE.md`
- `docs/DATA-FLOW.md`
- `docs/COMPONENTS.md`
- `docs/CONVENTIONS.md`
- `docs/SETUP.md`
- `docs/TESTING.md`

## High-Signal Project Facts

- Routing and guards are defined in `src/App.tsx` using `createBrowserRouter`.
- Provider boundaries are:
  - global: `AuthProvider -> ToastProvider -> RomanticBackdrop -> RouterProvider`
  - authenticated route shell: `GalleryProvider -> Outlet + GalleryModalRenderer`
- Firestore is the metadata source (`images`, `videos`, `events`), Storage holds media bytes.
- IndexedDB caches thumbnails:
  - images: key = image id
  - videos: key = `video:<id>`
- Modal supports mixed media; videos are loaded on demand.

## Implementation Rules

- Use `useAuth`, `useGallery`, and service wrappers instead of ad-hoc Firebase calls.
- Keep user-facing strings env-driven through `src/config.ts`.
- Do not mount an additional modal instance.
- Preserve local-date parsing behavior when working with timeline/photo grouping.

## Build/Test Commands

```bash
npm run lint
npm run test
npm run build
```
