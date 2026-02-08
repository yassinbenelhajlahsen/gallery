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
            <span className="text-6xl" aria-hidden="true">
              💔
            </span>
            <h1 className="text-5xl font-bold text-[#333]">404</h1>
            <p className="text-lg text-[#777]">{config.notFoundText}</p>
          </div>

          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-[#FFE39F] via-[#FFB1C7] to-[#D8ECFF] px-8 py-3 text-lg font-semibold text-[#2c2c2c] shadow-lg shadow-[#ffe1b8]/60 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
          >
            <span aria-hidden="true">←</span>
            Go back home
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPage;
