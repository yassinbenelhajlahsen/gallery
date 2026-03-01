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
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .safe-area-fade::before {
          top: 0;
          height: calc(env(safe-area-inset-top, 0px) + 48px);
          background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 60%);
        }

        .safe-area-fade::after {
          bottom: 0;
          height: calc(env(safe-area-inset-bottom, 0px) + 48px);
          background: linear-gradient(0deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 60%);
        }
      `}</style>

      <section className="safe-area-fade relative overflow-hidden flex min-h-screen w-full items-center justify-center px-6 py-16">
        <div className="relative z-10 grid w-full max-w-5xl gap-10 rounded-[36px] bg-white/80 p-5 sm:p-10 shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl transition-all duration-500 hover:ring-[#FACAD5]/60 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6 text-left">
            <p className="text-sm uppercase racking-[0.4em] text-[#888] text-center">
              Private gallery
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-[#333] text-center">
              {config.loginHeading}
            </h1>
            <img
              src="/favicon-v2.png"
              alt="Gallery logo"
              className="mx-auto mt-8 -mb-8 h-40 w-40 select-none sm:mt-0 sm:mb-0"
            />
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-[28px] bg-white/80 p-5 sm:p-8 shadow-xl shadow-[#d1e9ff]/40 ring-1 ring-white/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#fbcdd5]/60"
          >
            <header className="space-y-1 text-center sm:text-left">
              <h2 className="text-2xl font-semibold">Enter password</h2>
            </header>
            <div className="space-y-2">
              <FloatingInput
                id="access-code"
                type={showPassword ? "text" : "password"}
                label="Password"
                className="w-full transition focus:scale-[1.01]"
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
              {isSubmitting ? "Unlocking memories…" : "Unlock gallery"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
};

export default LoginPage;
