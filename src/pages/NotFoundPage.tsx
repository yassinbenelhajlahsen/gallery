// src/pages/NotFoundPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { usePageReveal } from "../hooks/usePageReveal";
import { config } from "../config";

const NotFoundPage: React.FC = () => {
  const isVisible = usePageReveal();

  return (
    <section className="flex min-h-screen w-full items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-lg space-y-8 rounded-[36px] bg-white/80 p-10 text-center shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-8 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-[#999]">
              Page not found
            </p>
            <h1 className="font-display text-8xl leading-[0.9] text-[#333]">
              404
            </h1>
            <p className="text-lg text-[#777]">{config.notFoundText}</p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 border-b border-[#222] pb-1 text-base font-medium text-[#222] touch-manipulation active:opacity-60"
          >
            Go back home
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPage;
