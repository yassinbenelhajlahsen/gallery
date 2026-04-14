// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FloatingInput } from "../components/ui/FloatingInput";
import { useAuth } from "../context/AuthContext";
import { config } from "../config";

const LoginPage: React.FC = () => {
  const { login, user, initializing } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (user) {
      navigate("/loading", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(password);
      navigate("/loading", { replace: true });
    } catch (loginError) {
      const rawMessage =
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again.";
      const message = rawMessage.includes("auth/invalid-credential")
        ? "Wrong password silly!"
        : rawMessage;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting || initializing;

  return (
    <section
      className="relative flex min-h-dvh w-full items-start justify-center px-6 pb-16 lg:items-center lg:py-16"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
    >
      <div className="w-full max-w-sm space-y-10">
        {/* Wordmark */}
        <header className="space-y-4">
          <img
            src="/favicon-v2.png"
            alt="Gallery logo"
            className="h-24 w-24 select-none"
          />
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-[#888]">
              Private gallery
            </p>
            <h1 className="font-display text-6xl leading-[0.95] text-[#222]">
              {config.loginHeading}
            </h1>
          </div>
          <span className="block h-px w-10 bg-[#222]" aria-hidden="true" />
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <FloatingInput
              id="access-code"
              type={showPassword ? "text" : "password"}
              label="Password"
              className="w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={disabled}
              focusColor="#D8ECFF"
              borderColor="#E0E0E0"
              labelColor="#888"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="flex h-9 w-9 items-center justify-center text-[#888] transition hover:text-[#222]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m17.94 17.94-11.88-11.88" />
                      <path d="M10.585 10.585a2 2 0 0 0 2.83 2.83" />
                      <path d="M9.88 4.24c.69-.16 1.41-.24 2.12-.24 4.2 0 7.87 2.53 9.65 6.5-.64 1.4-1.56 2.64-2.68 3.67" />
                      <path d="M6.62 6.62C4.7 7.95 3.11 9.79 2 12c1.78 3.97 5.45 6.5 9.65 6.5 1.06 0 2.1-.15 3.1-.44" />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              }
            />
            <p
              role="status"
              aria-live="polite"
              className="text-sm font-medium text-[#FF7EB9]"
            >
              {error}
            </p>
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="w-full border border-[#222] bg-[#222] py-3 text-sm font-semibold uppercase tracking-widest text-white transition-all duration-200 hover:bg-transparent hover:text-[#222] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Unlock gallery"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default LoginPage;
