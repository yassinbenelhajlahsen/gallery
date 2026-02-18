import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authState, galleryState } = vi.hoisted(() => ({
  authState: {
    user: { uid: "u-1" } as { uid: string } | null,
    initializing: false,
  },
  galleryState: {
    hasGalleryLoadedOnce: true,
  },
}));

vi.mock("../../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: unknown }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock("../../context/GalleryContext", () => ({
  GalleryProvider: ({ children }: { children: unknown }) => (
    <>{children}</>
  ),
  useGallery: () => galleryState,
}));

vi.mock("../../context/ToastContext", () => ({
  ToastProvider: ({ children }: { children: unknown }) => <>{children}</>,
}));

vi.mock("../../components/layout/Navbar", () => ({
  default: () => <div data-testid="navbar" />, 
}));

vi.mock("../../components/layout/Footer", () => ({
  default: () => <div data-testid="footer" />, 
}));

vi.mock("../../components/layout/ScrollToTop", () => ({
  default: () => null,
}));

vi.mock("../../components/gallery/GalleryModalRenderer", () => ({
  default: () => null,
}));

vi.mock("../../pages/LoginPage", () => ({
  default: () => <div>LOGIN_PAGE</div>,
}));

vi.mock("../../pages/LoadingScreen", () => ({
  default: () => <div>LOADING_PAGE</div>,
}));

vi.mock("../../pages/HomePage", () => ({
  default: () => <div>HOME_PAGE</div>,
}));

vi.mock("../../pages/TimelinePage", () => ({
  default: () => <div>TIMELINE_PAGE</div>,
}));

vi.mock("../../pages/PhotosPage", () => ({
  default: () => <div>PHOTOS_PAGE</div>,
}));

vi.mock("../../pages/VideosPage", () => ({
  default: () => <div>VIDEOS_PAGE</div>,
}));

vi.mock("../../pages/NotFoundPage", () => ({
  default: () => <div>NOT_FOUND_PAGE</div>,
}));

vi.mock("../../pages/AdminPage", () => ({
  default: () => <div>ADMIN_PAGE</div>,
}));

const renderAppAt = async (path: string) => {
  window.history.replaceState({}, "", path);
  vi.resetModules();
  const { default: App } = await import("../../App");
  render(<App />);
};

describe("App routing guards", () => {
  beforeEach(() => {
    authState.user = { uid: "u-1" };
    authState.initializing = false;
    galleryState.hasGalleryLoadedOnce = true;
  });

  it("redirects unauthenticated users to /login", async () => {
    authState.user = null;
    await renderAppAt("/home");

    await waitFor(() => {
      expect(screen.getByText("LOGIN_PAGE")).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/login");
  });

  it("sends authenticated users to /loading when gallery has not loaded", async () => {
    galleryState.hasGalleryLoadedOnce = false;
    await renderAppAt("/home");

    await waitFor(() => {
      expect(screen.getByText("LOADING_PAGE")).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/loading");
  });

  it("redirects authenticated users away from /login to /loading", async () => {
    galleryState.hasGalleryLoadedOnce = false;
    await renderAppAt("/login");

    await waitFor(() => {
      expect(screen.getByText("LOADING_PAGE")).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/loading");
  });

  it("redirects /loading to /home once gallery has loaded", async () => {
    galleryState.hasGalleryLoadedOnce = true;
    await renderAppAt("/loading");

    await waitFor(() => {
      expect(screen.getByText("HOME_PAGE")).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/home");
  });

});
