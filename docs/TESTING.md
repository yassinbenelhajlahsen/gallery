# Testing

> Minimal reference for running tests in this repo.

## Test Stack

- Vitest
- jsdom
- Testing Library (`@testing-library/react`, `@testing-library/jest-dom`)

## Commands

```bash
npm run test        # run all tests once
npm run test:watch  # watch mode
```

## Test Layout

Tests are centralized under `src/test/`:

- `src/test/app/` — route/guard coverage
- `src/test/components/` — focused component behavior
- `src/test/context/` — provider/context flows
- `src/test/pages/` — page helper utilities
- `src/test/services/` — service-layer logic

Global test setup is in `src/test/setup.ts`:

- `@testing-library/jest-dom` matchers
- automatic `cleanup()` after each test

## Current Coverage

- `src/test/app/AppRouting.test.tsx`
  - `/upload` redirects to `/admin?tab=upload`
  - unauthenticated users are redirected to `/login`
  - authenticated users with unloaded gallery are redirected to `/loading`

- `src/test/services/authService.test.ts`
  - empty password rejection
  - sign-in wiring with configured auth email
  - auth state subscription delegation
  - sign-out delegation

- `src/test/services/storageService.test.ts`
  - image metadata sorting and thumb fallback behavior
  - video metadata filtering, thumb fallback, and `durationSeconds` normalization
  - Firestore/Storage permission-denied error mapping

- `src/test/context/GalleryContext.test.tsx`
  - gallery loads videos even when image metadata is empty
  - cache/state reset when auth user logs out

- `src/test/components/admin/AdminDeleteTab.test.tsx`
  - image delete two-step confirm flow
  - storage + metadata delete wiring
  - refresh/toast side effects

- `src/test/pages/uploadMediaUtils.test.ts`
  - file extension detection (`.mp4`, `.mov`)
  - unsupported extension handling
  - multi-dot filename edge cases
