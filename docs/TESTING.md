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

## Current Smoke Tests

- `src/services/authService.test.ts` — auth input validation + sign-in call wiring
- `src/pages/uploadMediaUtils.test.ts` — upload media type/extension classification
- `src/context/GalleryContext.test.tsx` — gallery load path when images are empty still loads videos
