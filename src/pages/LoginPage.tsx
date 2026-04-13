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
    <>
      <style>{`
        .safe-area-fade::before,
        .safe-area-fade::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          pointer-events: none; /* don't intercept taps */
          z-index: 0; /* sit above background, below content (content will be z-10) */
          mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
          -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .safe-area-fade::before {
          top: 0;
          height: calc(env(safe-area-inset-top, 0px) + 140px);
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%);
        }

        .safe-area-fade::after {
          bottom: 0;
          height: calc(env(safe-area-inset-bottom, 0px) + 140px);
          background: linear-gradient(0deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%);
          mask-image: linear-gradient(0deg, #000 0%, transparent 100%);
          -webkit-mask-image: linear-gradient(0deg, #000 0%, transparent 100%);
        }
      `}</style>

      <section
        className="safe-area-fade relative flex min-h-dvh w-full items-start justify-center px-6 pb-16 lg:items-center lg:py-16 lg:pt-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-6 px-2 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:rounded-[36px] lg:bg-white/80 lg:p-10 lg:shadow-[0_35px_120px_rgba(248,180,196,0.35)] lg:ring-1 lg:ring-white/60 lg:backdrop-blur-2xl">
          <div className="flex flex-col items-center gap-2 lg:gap-6 lg:items-start">
            <img
              src="/favicon-v2.png"
              alt="Gallery logo"
              className="h-16 w-16 select-none lg:mx-auto lg:h-40 lg:w-40"
            />
            <p className="text-xs uppercase tracking-[0.4em] text-[#888] lg:text-sm lg:text-center lg:w-full">
              Private gallery
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-[#333] lg:text-4xl lg:text-center lg:w-full">
              {config.loginHeading}
            </h1>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full space-y-4 lg:space-y-6 lg:rounded-[28px] lg:bg-white/80 lg:p-8 lg:shadow-xl lg:shadow-[#d1e9ff]/40 lg:ring-1 lg:ring-white/60"
          >
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
                focusColor="#F7DEE2"
                borderColor="#F0F0F0"
                labelColor="#333"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#ff8fb3] shadow-sm shadow-[#ffc7da]/60 transition hover:scale-105"
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
              className="w-full rounded-full bg-linear-to-r from-[#FFB1C7] via-[#FFD4E3] to-[#D8ECFF] py-3 text-lg font-semibold text-[#1c1c1c] shadow-lg shadow-[#f8bfd0]/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#FFC7DA] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
            >
              {isSubmitting ? "Signing in…" : "Unlock gallery"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
};

export default LoginPage;
