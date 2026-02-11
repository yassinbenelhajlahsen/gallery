# Setup Guide

> Clone, configure, and run the gallery locally.

## Prerequisites

- **Node.js 18+** and npm
- A **Firebase project** with Authentication (Email/Password), Storage, and Firestore enabled

## 1. Clone & Install

```bash
git clone https://github.com/yassinbenelhajlahsen/gallery.git
cd gallery
npm install
```

## 2. Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (or use an existing one)
2. **Authentication** → Sign-in method → Enable **Email/Password**
3. **Authentication** → Users → Add a user (email + password — this is your login)
4. **Storage** → Get started → Create default bucket
5. **Storage** → Rules → lock access to your owner UID:

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       function isOwner() {
         return request.auth != null
           && request.auth.uid == "YOUR_OWNER_UID";
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

6. **Firestore** → Get started → Create database
7. **Firestore** → Rules → lock access to your owner UID:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isOwner() {
         return request.auth != null
           && request.auth.uid == "YOUR_OWNER_UID";
       }

       match /events/{eventId} {
         allow read, write: if isOwner();
       }

       // Required by this app for gallery metadata
       match /images/{imageId} {
         allow read, write: if isOwner();
       }

       // Required by this app for video metadata
       match /videos/{videoId} {
         allow read, write: if isOwner();
       }

       match /{document=**} {
         allow read, write: if false;
       }
     }
   }

   ```
8. **Project Settings** → Your apps → Add a **Web app** → Copy the config values

## 3. Environment Variables

```bash
cp .env.example .env
```

Fill in your Firebase credentials and display strings:

```bash
# Required — Firebase
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Required for login UX (not the security boundary)
VITE_AUTH_EMAIL=your-login@example.com

# Optional — display strings (sensible defaults exist)
VITE_SITE_TITLE=My Gallery
VITE_COUPLE_DISPLAY=Partner A & Partner B
```

## 4. Run

```bash
npm run dev        # Vite dev server at http://localhost:5173
```

## 5. Build & Preview

```bash
npm run build      # TypeScript check + production build
npm run preview    # Serve the build locally
```

## Storage Structure

The app expects this layout in Firebase Storage (created automatically on first upload):

```
images/
├── full/    ← original JPEGs
└── thumb/   ← 480px thumbnails

videos/
├── full/    ← original videos
└── thumb/   ← poster JPEGs
```

Both are written by the uploader. See [DATA-FLOW.md](DATA-FLOW.md) for the full pipeline.

## Database Structure

The app uses Firestore for timeline events (created via the uploader UI):

```
events/
├── <auto-id-1>/    ← event documents (Firestore-generated IDs)
├── <auto-id-2>/
└── ...
```

Each event document contains: `{ date, title, emojiOrDot?, imageIds?, createdAt? }`. The `id` used by the app is the Firestore document ID. See [DATA-FLOW.md](DATA-FLOW.md) for the events service.

## CORS (Optional)

If thumbnail downloads fail locally, deploy the CORS config:

```bash
gsutil cors set cors.json gs://your-project.appspot.com
```

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — provider hierarchy, routing, file map
- [DATA-FLOW.md](DATA-FLOW.md) — caching, loading sequence, memory management
- [COMPONENTS.md](COMPONENTS.md) — component props and usage
- [CONVENTIONS.md](CONVENTIONS.md) — code patterns and how-to guides
- [TESTING.md](TESTING.md) — running smoke tests with Vitest
