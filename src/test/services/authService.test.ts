import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  onAuthStateChangedMock,
  signInWithEmailAndPasswordMock,
  signOutMock,
} = vi.hoisted(() => ({
  onAuthStateChangedMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: onAuthStateChangedMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signOut: signOutMock,
}));

vi.mock("../../services/firebaseAuth", () => ({
  auth: { mocked: true },
}));

vi.mock("../../config", () => ({
  config: {
    authEmail: "owner@example.com",
  },
}));

import { authService, signInWithPassword } from "../../services/authService";

describe("authService", () => {
  beforeEach(() => {
    onAuthStateChangedMock.mockReset();
    signInWithEmailAndPasswordMock.mockReset();
    signOutMock.mockReset();
  });

  it("rejects empty password before calling Firebase", async () => {
    await expect(signInWithPassword("")).rejects.toThrow("Password is required");
    expect(signInWithEmailAndPasswordMock).not.toHaveBeenCalled();
  });

  it("signs in with configured auth email", async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue({ user: { uid: "1" } });

    await signInWithPassword("secret");

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      { mocked: true },
      "owner@example.com",
      "secret",
    );
  });

  it("delegates auth-state subscription to Firebase and returns unsubscribe", () => {
    const unsubscribe = vi.fn();
    const callback = vi.fn();
    onAuthStateChangedMock.mockReturnValue(unsubscribe);

    const returned = authService.subscribeToAuthChanges(callback);

    expect(onAuthStateChangedMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangedMock).toHaveBeenCalledWith(
      { mocked: true },
      callback,
    );
    expect(returned).toBe(unsubscribe);
  });

  it("delegates signOut to Firebase auth instance", async () => {
    signOutMock.mockResolvedValue(undefined);

    await authService.signOut();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ mocked: true });
  });
});
