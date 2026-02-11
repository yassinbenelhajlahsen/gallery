# Gallery

A private, password-protected photo and video gallery built as a gift — and as a real engineering project.

React 19 · TypeScript · Firebase · Tailwind CSS · Vite

## Why This Exists

I built this to solve a real problem: a private, fast, and beautiful way to browse and upload shared photos and videos — without relying on Google Photos or iCloud shared albums. It also gave me an excuse to dig into performance patterns (IndexedDB caching, progressive image loading, blob URL lifecycle management) that don't come up in typical CRUD apps.

## Privacy by Design

This repo is public, but the app is private. Every user-facing string (names, titles, messages) is injected via environment variables at build time — the codebase contains **zero personal information**. Firebase credentials, auth emails, and display names all live in a git-ignored `.env` file. The app itself is gated behind Firebase Auth with a single hardcoded email, so access requires knowing the password.

## Architecture at a Glance

```
React SPA (Vite)
  ├── Firebase Auth         — password-only login, single account
  ├── Firebase Storage      — images (full-res + 480px thumbnails) and videos (original + poster thumbnails), dual-write on upload
  ├── IndexedDB cache       — instant gallery restore for returning visitors
  └── Progressive URL loading — cached thumbs + windowed full-res URL resolution
```

The app uses a **three-layer provider hierarchy** (Auth → Gallery → Toast) that owns all state. Pages are thin consumers. A single global lightbox is mounted outside the router so it persists across navigations. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full breakdown.

## Key Technical Decisions

| Decision                         | Tradeoff                              | Why                                                                                                                 |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Client-side JPEG conversion**  | Adds ~200ms per upload vs raw upload  | Normalizes formats (HEIC, PNG) and generates thumbnails without a backend                                           |
| **IndexedDB thumbnail cache**    | ~5MB storage per 200 photos           | Instant gallery restore (<50ms) vs re-downloading every thumbnail on revisit                                        |
| **Windowed full-res preloading** | More complex than loading all at once | Keeps memory bounded in the modal — only ±10 ahead / ±5 behind are in memory (images only; videos stream on-demand) |
| **Blob URLs over data URIs**     | Must track and revoke to avoid leaks  | Much faster to create/render; the codebase has explicit cleanup in every effect                                     |
| **No backend / serverless**      | Limited to Firebase's capabilities    | Zero infrastructure to maintain — Firebase handles auth, storage, and CDN                                           |
| **Env-driven display strings**   | Extra config step for contributors    | Keeps the repo safe for public visibility without any personal data                                                 |

## What I'd Build Next

- **Server-side thumbnailing** — Cloud Function triggered on upload to generate thumbnails, removing the client-side step
- **Shared albums / multi-user** — Firestore metadata layer with per-album access control
- **Search & filtering** — Full-text search across event names, captions, and dates
- **Optimistic UI for uploads** — Show the image in the gallery immediately, sync in background
- **E2E tests** — Playwright flows for login → upload → gallery → modal interactions

## Docs

Detailed documentation lives in [`docs/`](docs/):

| Doc                                         | What it covers                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | Provider hierarchy, routing, guards, file map, env config                |
| [**DATA-FLOW.md**](docs/DATA-FLOW.md)       | Firebase → cache → context pipeline, loading sequence, memory management |
| [**COMPONENTS.md**](docs/COMPONENTS.md)     | Every component and page — props, behavior, usage examples               |
| [**CONVENTIONS.md**](docs/CONVENTIONS.md)   | Code patterns, styling rules, how-to guides, common pitfalls             |
| [**SETUP.md**](docs/SETUP.md)               | Cloning, configuring Firebase, and running locally                       |
| [**TESTING.md**](docs/TESTING.md)           | Test runner setup and smoke test commands                                |

## Quick Start

```bash
git clone https://github.com/yassinbenelhajlahsen/gallery.git
cd gallery
npm install
cp .env.example .env   # fill in Firebase creds
npm run dev
```

Full setup instructions → [docs/SETUP.md](docs/SETUP.md)
