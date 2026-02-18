import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAppMock, getAppsMock, initializeAppMock } = vi.hoisted(() => ({
  getAppMock: vi.fn(),
  getAppsMock: vi.fn(),
  initializeAppMock: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  getApp: getAppMock,
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
}));

const stubRequiredFirebaseEnv = () => {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "auth.example.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "proj");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "bucket");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "sender");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "app-id");
};

describe("firebaseApp bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    stubRequiredFirebaseEnv();

    getAppMock.mockReset();
    getAppsMock.mockReset();
    initializeAppMock.mockReset();
  });

  it("reuses an existing Firebase app when already initialized", async () => {
    getAppsMock.mockReturnValue([{}]);
    getAppMock.mockReturnValue({ app: "existing" });

    const mod = await import("../../services/firebaseApp");

    expect(mod.app).toEqual({ app: "existing" });
    expect(getAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it("initializes Firebase app when no app exists", async () => {
    getAppsMock.mockReturnValue([]);
    initializeAppMock.mockReturnValue({ app: "new" });

    const mod = await import("../../services/firebaseApp");

    expect(mod.app).toEqual({ app: "new" });
    expect(initializeAppMock).toHaveBeenCalledWith({
      apiKey: "key",
      authDomain: "auth.example.com",
      projectId: "proj",
      storageBucket: "bucket",
      messagingSenderId: "sender",
      appId: "app-id",
    });
  });

  it("throws with a clear error when a required env var is missing", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_FIREBASE_API_KEY", "");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "auth.example.com");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "proj");
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "sender");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "app-id");

    getAppsMock.mockReturnValue([]);

    await expect(import("../../services/firebaseApp")).rejects.toThrow(
      "[Firebase] Missing required environment variable: VITE_FIREBASE_API_KEY",
    );
  });
});
