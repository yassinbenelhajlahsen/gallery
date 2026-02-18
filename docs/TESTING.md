# Testing

> Current automated test setup and what it covers.

## Stack

- Vitest
- jsdom
- Testing Library (`@testing-library/react`, `@testing-library/jest-dom`)

## Commands

```bash
npm run test
npm run test:watch
```

## Test Setup

Global setup file: `src/test/setup.ts`

- enables `jest-dom` matchers
- runs `cleanup()` after each test

## Test Layout

- `src/test/app/` -> routing/guard behavior
- `src/test/components/` -> component-level behavior
- `src/test/context/` -> provider lifecycle/state flows
- `src/test/services/` -> service-layer logic
- `src/test/pages/` -> page-adjacent utility behavior
- `src/test/utils/` -> standalone utility logic

## Current Coverage Snapshot

### `src/test/app/AppRouting.test.tsx`

- unauthenticated users are redirected to `/login`
- authenticated users with unloaded gallery are redirected to `/loading`

### `src/test/services/authService.test.ts`

- empty password validation
- sign-in call wiring to configured auth email
- auth state subscription delegation
- sign-out delegation

### `src/test/services/storageService.test.ts`

- image metadata sort + thumb fallback
- ISO/timestamp date normalization
- video metadata filtering + thumb fallback + duration normalization
- permission-denied error mapping

### `src/test/context/GalleryContext.test.tsx`

- videos load even when image metadata is empty
- state/cache reset behavior when auth user becomes null

### `src/test/components/admin/DeleteTab.test.tsx`

- two-step delete confirm flow
- storage + Firestore delete wiring
- search filtering behavior

### `src/test/pages/uploadMediaUtils.test.ts`

- video extension detection and normalization
- unsupported extension handling
- multi-dot filename support

### `src/test/utils/durationFormat.test.ts`

- `MM:SS` formatting behavior
- invalid input handling

### `src/test/utils/uploadDateMetadata.test.ts`

- JPEG EXIF date extraction
- QuickTime/MP4 creation date extraction
- `lastModified` fallback

## Known Gaps

- No end-to-end browser tests yet (upload/login/modal flows are not fully exercised as user journeys).
