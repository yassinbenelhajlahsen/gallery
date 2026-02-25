# Gallery

A private, password-protected photo and video gallery built with React + Firebase.

React 19 · TypeScript · Firebase Auth/Firestore/Storage · Tailwind CSS v4 · Vite

## Why This Exists

This project is a real-world private gallery app focused on:

- owner-only access with Firebase Auth + security rules
- fast return visits via IndexedDB thumbnail caching
- progressive image loading with memory-aware modal preloading
- no personal strings checked into source (env-driven branding)

## Privacy by Design

- User-facing strings are read from `VITE_*` env vars via `src/config.ts`.
- Firebase credentials and display values live in `.env` (git-ignored).
- Real protection is enforced by Firebase Security Rules (owner UID), not frontend checks.

## Architecture at a Glance

```text
AuthProvider
  └─ ToastProvider
      └─ RomanticBackdrop
          └─ RouterProvider

Route shell (authenticated only):
RequireAuth -> GalleryProvider -> Outlet + global GalleryModalRenderer
```

Core data/storage model:

- Firestore `images` / `videos` docs are the source of media metadata.
- Storage stores media bytes under:
  - `images/full/*` + `images/thumb/*`
  - `videos/full/*` + `videos/thumb/*`
- IndexedDB (`mediaCacheService`) caches:
  - image thumbs as blobs keyed by image id
  - video poster thumbs as blobs keyed by `video:<id>`

Admin tools live at `/admin` (upload + delete tabs).

Admin implementation is modular:

- `src/components/admin/UploadTab.tsx` handles form UX/progress and delegates upload/event writes to `src/services/uploadService.ts`.
- `src/components/admin/DeleteTab.tsx` handles search/edit/delete UI and delegates destructive/update operations to `src/services/deleteService.ts`.

## Key Technical Decisions

| Decision | Tradeoff | Why |
| --- | --- | --- |
| Firestore-backed media metadata | Extra write during upload | Strong typed metadata queries + easier evolution than Storage customMetadata |
| Client-side image conversion + thumb generation | CPU on upload | Normalized JPEG outputs + consistent thumbnail quality without backend jobs |
| IndexedDB thumbnail cache | Browser storage usage | Instant gallery restore for returning sessions |
| Signed URL strategy for full-res | Requires URL bookkeeping in memory | Browser handles loading/caching directly; no manual full-res blob lifecycle |
| On-demand video playback in modal | First video open has URL fetch | Avoids prefetching heavy video bytes during gallery bootstrap |

## Current Product Shape

- `/`: random 9-photo hero grid (stable selection per dataset)
- `/home`: legacy redirect to `/` for backward compatibility
- `/photos`: images grouped by year -> month
- `/videos`: videos grouped by year -> month with duration badges
- `/timeline`: events from Firestore; event opens mixed media modal (images + videos)
- `/admin?tab=upload|delete`: upload and destructive management tools

## Docs

Detailed docs live in [`docs/`](docs/):

| Doc | What it covers |
| --- | --- |
| [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | Provider boundaries, routing, directory map, env + data schemas |
| [**DATA-FLOW.md**](docs/DATA-FLOW.md) | Service contracts, GalleryContext lifecycle, cache and modal flow |
| [**COMPONENTS.md**](docs/COMPONENTS.md) | Component/page behavior and interaction patterns |
| [**CONVENTIONS.md**](docs/CONVENTIONS.md) | Coding/UI conventions and implementation recipes |
| [**SETUP.md**](docs/SETUP.md) | Firebase setup, rules, env config, local run |
| [**TESTING.md**](docs/TESTING.md) | Vitest setup and covered behavior |

## Quick Start

```bash
git clone https://github.com/yassinbenelhajlahsen/gallery.git
cd gallery
npm install
cp .env.example .env
npm run dev
```

Then fill required Firebase vars in `.env` (see `docs/SETUP.md`).
