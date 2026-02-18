# Setup Guide

> Local setup for the current Firebase-backed gallery.

## Prerequisites

- Node.js 18+
- npm
- Firebase project with:
  - Authentication (Email/Password)
  - Cloud Firestore
  - Cloud Storage

## 1. Clone & Install

```bash
git clone https://github.com/yassinbenelhajlahsen/gallery.git
cd gallery
npm install
```

## 2. Firebase Project Setup

1. Create/select project in Firebase Console.
2. Enable **Authentication -> Email/Password**.
3. Create owner user (email + password).
4. Enable **Cloud Firestore**.
5. Enable **Cloud Storage**.

## 3. Security Rules (owner-only)

Replace `YOUR_OWNER_UID` in both rule sets.

### Storage rules

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isOwner() {
      return request.auth != null && request.auth.uid == "YOUR_OWNER_UID";
    }

    match /images/{allPaths=**} {
      allow read, write: if isOwner();
    }

    match /videos/{allPaths=**} {
      allow read, write: if isOwner();
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Firestore rules

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == "YOUR_OWNER_UID";
    }

    match /events/{eventId} {
      allow read, write: if isOwner();
    }

    match /images/{imageId} {
      allow read, write: if isOwner();
    }

    match /videos/{videoId} {
      allow read, write: if isOwner();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 4. Web App Credentials

In Firebase project settings, create a web app and copy config values.

## 5. Environment Variables

```bash
cp .env.example .env
```

Required in `.env`:

```txt
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_AUTH_EMAIL=
```

Optional branding text vars (defaults exist):

```txt
VITE_SITE_TITLE=
VITE_COUPLE_DISPLAY=
VITE_SITE_DESCRIPTION=
VITE_LOGIN_HEADING=
VITE_LOGOUT_TOAST=
VITE_NOT_FOUND_TEXT=
```

Note: `.env.example` contains `measurementId`, but the app does not currently consume it.

## 6. Run

```bash
npm run dev
```

## 7. Build & Test

```bash
npm run lint
npm run test
npm run build
npm run preview
```

## Expected Backend Structure

### Storage

```txt
images/full/<id>.jpg
images/thumb/<id>.jpg
videos/full/<id>.mp4|.mov
videos/thumb/<basename>.jpg
```

### Firestore

```txt
events/<docId>
images/<id>
videos/<id>
```

`UploadTab` creates these documents/paths.

## Optional: CORS for Local Development

If Storage fetches are blocked in local environments:

```bash
gsutil cors set cors.json gs://<your-storage-bucket>
```

## Related Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATA-FLOW.md](DATA-FLOW.md)
- [COMPONENTS.md](COMPONENTS.md)
- [TESTING.md](TESTING.md)
