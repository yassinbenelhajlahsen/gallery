// src/App.tsx
import React from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LoadingScreen from "./pages/LoadingScreen";
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import PhotosPage from "./pages/PhotosPage";
import MapPage from "./pages/MapPage";
import VideosPage from "./pages/VideosPage";
import AdminPage from "./pages/AdminPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GalleryProvider, useGallery } from "./context/GalleryContext";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ScrollToTop from "./components/layout/ScrollToTop";
import GalleryModalRenderer from "./components/gallery/GalleryModalRenderer";
import { ToastProvider } from "./context/ToastContext";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorBoundary, { RouteErrorPage } from "./components/ui/ErrorBoundary";
import { config } from "./config";

const AppBackdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="relative min-h-screen w-full text-[#333]"
    style={{
      backgroundColor: "#FAFAF7",
      backgroundImage:
        "linear-gradient(to bottom, #FBDCE7 0%, transparent 400px)",
    }}
  >
    <div
      className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,220,230,0.6),transparent_55%),radial-gradient(circle_at_bottom,rgba(216,236,255,0.5),transparent_60%),radial-gradient(circle_at_center,rgba(255,238,173,0.35),transparent_45%)]"
      aria-hidden="true"
    />
    <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
  </div>
);

const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main
        className="relative z-10 flex-1 px-4 pb-20 sm:pt-5 sm:pb-10"
        style={{
          paddingTop: "max(0.75rem, calc(0.25rem + env(safe-area-inset-top)))",
        }}
      >
        <div className="w-full">
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
};

const RequireAuth: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <GateFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <GateFallback message="Checking your session…" />;
  }

  if (user) {
    return <Navigate to="/loading" replace />;
  }

  return <>{children}</>;
};

const GalleryAppShell: React.FC = () => (
  <GalleryProvider>
    <Outlet />
    <GalleryModalRenderer />
  </GalleryProvider>
);

const RequireGalleryLoaded: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { hasGalleryLoadedOnce } = useGallery();
  const location = useLocation();

  if (!hasGalleryLoadedOnce) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/loading" replace state={{ from }} />;
  }

  return <>{children}</>;
};

const LoadingRoute: React.FC = () => {
  const { hasGalleryLoadedOnce } = useGallery();
  const location = useLocation();

  const redirectTarget = (() => {
    if (typeof location.state !== "object" || location.state === null) {
      return "/";
    }
    const from =
      "from" in location.state && typeof location.state.from === "string"
        ? location.state.from
        : null;
    if (!from || from.startsWith("/loading")) return "/";
    return from;
  })();

  if (hasGalleryLoadedOnce) {
    return <Navigate to={redirectTarget} replace />;
  }
  return <LoadingScreen />;
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
    path: "/",
    element: (
      <RequireAuth>
        <GalleryAppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: "loading", element: <LoadingRoute /> },
      {
        element: (
          <RequireGalleryLoaded>
            <MainLayout />
          </RequireGalleryLoaded>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: "home", element: <Navigate to="/" replace /> },
          { path: "timeline", element: <TimelinePage /> },
          { path: "map", element: <MapPage /> },
          { path: "photos", element: <PhotosPage /> },
          { path: "admin", element: <AdminPage />, },
          { path: "videos", element: <VideosPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

function App() {
  // Set document title from env so the HTML stays name-free
  React.useEffect(() => {
    document.title = config.siteTitle;
  }, []);

  // Sync html background-color to scroll position so iOS PWA rubber-band
  // overscroll shows pink at the top and white at the bottom.
  // Only apply on mobile; keep desktop always white.
  React.useEffect(() => {
    const html = document.documentElement;

    const isMobile =
      (typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)")?.matches) ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (!isMobile) {
      html.style.backgroundColor = "#FAFAF7";
      return;
    }

    const PINK = "#FBDCE7";
    const WHITE = "#FAFAF7";
    const THRESHOLD = 120;

    const sync = () => {
      html.style.backgroundColor = window.scrollY < THRESHOLD ? PINK : WHITE;
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <AppBackdrop>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </AppBackdrop>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
