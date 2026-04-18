import React from "react";
import { useRouteError } from "react-router-dom";
import { usePageReveal } from "../../hooks/usePageReveal";

const errorMessage = (error: unknown): string | null => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return null;
};

const ErrorCard: React.FC<{
  message: string | null;
  actions: React.ReactNode;
}> = ({ message, actions }) => {
  const isVisible = usePageReveal();

  return (
    <section className="flex min-h-screen w-full items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-lg space-y-8 rounded-[36px] bg-white/80 p-10 text-center shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-8 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-[#999]">
              Something went wrong
            </p>
            <h1 className="font-display text-8xl leading-[0.9] text-[#333]">
              oops.
            </h1>
            <p className="text-lg text-[#777]">An unexpected error occurred.</p>
          </div>

          {message && (
            <p className="break-words rounded-xl bg-[#FFF5F7] px-4 py-3 font-mono text-xs text-[#FF7EB9] ring-1 ring-[#FFD6E2]">
              {message}
            </p>
          )}

          <div className="flex flex-col items-center gap-5">{actions}</div>
        </div>
      </div>
    </section>
  );
};

const goHomeLink = (
  <a
    href="/"
    className="inline-flex items-center gap-2 border-b border-[#222] pb-1 text-base font-medium text-[#222] touch-manipulation active:opacity-60"
  >
    Go back home
    <span aria-hidden="true">→</span>
  </a>
);

// Used as errorElement on React Router routes — has access to router context
export const RouteErrorPage: React.FC = () => {
  const error = useRouteError();
  return <ErrorCard message={errorMessage(error)} actions={goHomeLink} />;
};

// Used as a React class ErrorBoundary wrapping RouterProvider — no router context
type State = { hasError: boolean; error: Error | null };

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorCard
          message={this.state.error?.message ?? null}
          actions={
            <>
              <button
                onClick={this.reset}
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-[#FFE39F] via-[#FFB1C7] to-[#D8ECFF] px-8 py-3 text-lg font-semibold text-[#2c2c2c] shadow-lg shadow-[#ffe1b8]/60 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
              >
                Try again
              </button>
              {goHomeLink}
            </>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
