import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithEmailAndPasswordMock } = vi.hoisted(() => ({
  signInWithEmailAndPasswordMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signOut: vi.fn(),
}));

vi.mock("./firebaseConfig", () => ({
  auth: { mocked: true },
}));

vi.mock("../config", () => ({
  config: {
    authEmail: "owner@example.com",
  },
}));

import { signInWithPassword } from "./authService";

describe("authService", () => {
  beforeEach(() => {
    signInWithEmailAndPasswordMock.mockReset();
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
});
