import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  subscribeToAuthChangesMock,
  signInWithPasswordMock,
  signOutMock,
  authUser,
} = vi.hoisted(() => ({
  subscribeToAuthChangesMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  authUser: {
    current: null as { uid: string } | null,
  },
}));

vi.mock("../../services/authService", () => ({
  authService: {
    subscribeToAuthChanges: subscribeToAuthChangesMock,
    signInWithPassword: signInWithPasswordMock,
    signOut: signOutMock,
  },
}));

import { AuthProvider, useAuth } from "../../context/AuthContext";

const Probe = () => {
  const { user, initializing, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="uid">{user?.uid ?? "none"}</span>
      <span data-testid="initializing">{String(initializing)}</span>
      <button type="button" onClick={() => login("secret")}>login</button>
      <button type="button" onClick={() => logout()}>logout</button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset().mockResolvedValue(undefined);
    signOutMock.mockReset().mockResolvedValue(undefined);
    subscribeToAuthChangesMock.mockReset().mockImplementation((cb) => {
      cb(authUser.current);
      return () => {};
    });
  });

  it("throws when useAuth is used outside provider", () => {
    expect(() => render(<Probe />)).toThrow("useAuth must be used within an AuthProvider");
  });

  it("provides auth state and delegates login/logout", async () => {
    authUser.current = { uid: "owner-1" };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("uid")).toHaveTextContent("owner-1");
      expect(screen.getByTestId("initializing")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "login" }));
    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith("secret");
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
  });
});
