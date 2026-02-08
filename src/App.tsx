// src/App.tsx
import React from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LoadingScreen from "./pages/LoadingScreen";
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import PhotosPage from "./pages/PhotosPage";
import VideosPage from "./pages/VideosPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GalleryProvider, useGallery } from "./context/GalleryContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import GalleryModalRenderer from "./components/GalleryModalRenderer";
import { ToastProvider } from "./context/ToastContext";
import UploaderPage from "./pages/UploaderPage";
import NotFoundPage from "./pages/NotFoundPage";
import { config } from "./config";
const floatingHearts = [
  { id: "h1", className: "left-10 top-16 text-4xl text-[#F7DEE2]" },
  { id: "h2", className: "right-12 top-20 text-5xl text-[#D8ECFF] delay-75" },
  {
    id: "h3",
    className: "left-1/4 bottom-16 text-6xl text-[#FACAD5] delay-150",
  },
  {
    id: "h4",
    className: "right-24 bottom-12 text-4xl text-[#B9E4FF] delay-200",
  },
  { id: "h5", className: "left-12 bottom-8 text-5xl text-[#FFE89D] delay-300" },
  { id: "h6", className: "right-1/3 top-10 text-3xl text-[#FFF2C7] delay-500" },
];

const RomanticBackdrop: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-[#FAFAF7] text-[#333]">
    <div
      className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,220,230,0.6),transparent_55%),radial-gradient(circle_at_bottom,rgba(216,236,255,0.5),transparent_60%),radial-gradient(circle_at_center,rgba(255,238,173,0.35),transparent_45%)]"
      aria-hidden="true"
    />
    <div
      className="pointer-events-none absolute inset-0 opacity-85"
      aria-hidden="true"
    >
      {floatingHearts.map((heart) => (
        <span
          key={heart.id}
          className={`heart-floating absolute motion-safe:animate-[float_6s_ease-in-out_infinite] motion-reduce:hidden ${heart.className}`}
        >
          ♥
        </span>
      ))}
    </div>
    <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
  </div>
);

const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main className="relative z-10 flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
};

const GateFallback: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#FAFAF7] text-sm uppercase tracking-[0.3em] text-[#777]">
    {message}
  </div>
);

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireGalleryLoaded?: boolean;
  redirectIfGalleryReadyTo?: string;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireGalleryLoaded,
  redirectIfGalleryReadyTo,
}) => {
  const { user, initializing } = useAuth();
  const { hasGalleryLoadedOnce } = useGallery();

  if (initializing) {
    return <GateFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireGalleryLoaded && !hasGalleryLoadedOnce) {
    return <Navigate to="/loading" replace />;
  }

  if (
    !requireGalleryLoaded &&
    redirectIfGalleryReadyTo &&
    hasGalleryLoadedOnce
  ) {
    return <Navigate to={redirectIfGalleryReadyTo} replace />;
  }

  return <>{children}</>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initializing } = useAuth();
  const { hasGalleryLoadedOnce } = useGallery();

  if (initializing) {
    return <GateFallback message="Checking your session…" />;
  }

  if (user) {
    const destination = hasGalleryLoadedOnce ? "/home" : "/loading";
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: "/loading",
    element: (
      <ProtectedRoute redirectIfGalleryReadyTo="/home">
        <LoadingScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute requireGalleryLoaded>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: "home", element: <HomePage /> },
      { path: "timeline", element: <TimelinePage /> },
      { path: "photos", element: <PhotosPage /> },
      { path: "upload", element: <UploaderPage /> },
      { path: "videos", element: <VideosPage /> },
    ],
  },

  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

function App() {
  // Set document title from env so the HTML stays name-free
  React.useEffect(() => {
    document.title = config.siteTitle;
  }, []);

  return (
    <AuthProvider>
      <GalleryProvider>
        <ToastProvider>
          <RomanticBackdrop>
            <RouterProvider router={router} />
            <GalleryModalRenderer />
          </RomanticBackdrop>
        </ToastProvider>
      </GalleryProvider>
    </AuthProvider>
  );
}

export default App;
