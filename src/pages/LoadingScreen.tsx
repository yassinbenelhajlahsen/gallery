import { useEffect, useMemo, useRef, useState } from "react";
import { useGallery } from "../context/GalleryContext";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const ANIM_MS = 520; // how long the smooth tween lasts

const LoadingScreen = () => {
  const animals = useMemo(
    () => ["🦥", "🐨", "🦥", "🐨", "🦥", "🐨", "🦥", "🐨", "🦥", "🐨"],
    []
  );

  // Get real loading progress from Firebase via GalleryContext
  const { loadingProgress: realProgress } = useGallery();

  const [progress, setProgress] = useState(0); // smooth display value (0..100)

  const progressRef = useRef(0);
  const prevFilledRef = useRef(0);
  const [lastActivated, setLastActivated] = useState<number | null>(null);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Smoothly tween progress toward real Firebase progress
  useEffect(() => {
    const from = progressRef.current;
    const to = realProgress;
    if (from === to) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = clamp((now - start) / ANIM_MS, 0, 1);
      const next = from + (to - from) * easeOutCubic(t);
      setProgress(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [realProgress]);

  const filled = Math.min(10, Math.floor(progress / 10)); // 0..10
  const displayPct = Math.min(100, Math.round(progress));

  // Track the newest activated emoji for the "pop" animation
  useEffect(() => {
    const prev = prevFilledRef.current;
    prevFilledRef.current = filled;
    if (filled > prev) {
      // Use queueMicrotask to avoid synchronous setState warning
      queueMicrotask(() => setLastActivated(filled - 1));
    }
  }, [filled]);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAFAF7] px-4 py-12 text-center text-[#333] sm:px-6 sm:py-16">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,220,230,0.6),transparent_55%),radial-gradient(circle_at_bottom,rgba(216,236,255,0.5),transparent_60%)]"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      >
        <span className="absolute left-16 top-20 animate-[float_6s_ease-in-out_infinite] text-4xl text-[#F7DEE2]">
          ♥
        </span>
        <span className="absolute right-16 top-32 animate-[float_7s_ease-in-out_infinite] text-5xl text-[#D8ECFF] [animation-delay:0.75s]">
          ♥
        </span>
        <span className="absolute bottom-24 left-1/3 animate-[float_8s_ease-in-out_infinite] text-6xl text-[#FACAD5] [animation-delay:1.5s]">
          ♥
        </span>
        <span className="absolute left-1/4 top-40 animate-[float_5s_ease-in-out_infinite] text-3xl text-[#FFE89D] [animation-delay:2s]">
          ♥
        </span>
        <span className="absolute right-1/4 bottom-32 animate-[float_6.5s_ease-in-out_infinite] text-4xl text-[#E8D4F8] [animation-delay:1s]">
          ♥
        </span>
      </div>

      <div className="relative z-10 w-full max-w-3xl space-y-8 rounded-3xl bg-white/80 p-8 shadow-2xl ring-1 ring-white/70 backdrop-blur animate-[fadeIn_0.6s_ease-out] sm:space-y-10 sm:p-10">
        <header className="space-y-3">
          <p className="animate-[fadeIn_0.8s_ease-out] text-sm uppercase tracking-[0.35em] text-[#888]">
            Loading memories
          </p>
        </header>

        <div className="space-y-6" role="status" aria-live="polite">
          <div className="text-2xl font-bold text-[#F7889D]">{displayPct}%</div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:flex-nowrap sm:gap-2">
            {animals.map((emoji, index) => {
              const isActive = index < filled;
              const isPop = lastActivated === index;

              return (
                <div
                  key={index}
                  className={[
                    "emojiWrap",
                    isActive ? "isActive" : "",
                    isPop ? "isPop" : "",
                  ].join(" ")}
                  style={{ ["--i" as string]: index }}
                  aria-hidden="true"
                >
                  <span className="emojiLayer emojiColor">{emoji}</span>
                  <span className="emojiLayer emojiGray">{emoji}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1">
              <span
                className="h-2 w-2 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-[#FACAD5]"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="h-2 w-2 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-[#D8ECFF]"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-2 w-2 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-[#FFE89D]"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.6; }
          50% { transform: translateY(-25px) rotate(8deg); opacity: 0.8; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pop {
          0% { transform: scale(0.92); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }

        .emojiWrap {
          display: grid;
          place-items: center;
          width: 1.15em;
          height: 1.15em;
          font-size: clamp(32px, 9vw, 48px);
          transform: scale(0.92);
          opacity: 0.55;
          transition: transform 420ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 420ms ease;
          will-change: transform, opacity;
        }

        .emojiLayer {
          grid-area: 1 / 1;
          line-height: 1;
        }

        /* Keep grayscale constant on the gray layer; crossfade opacity only (smooth + reliable). */
        .emojiGray {
          filter: grayscale(1);
          opacity: 1;
          transition: opacity 380ms ease;
        }

        .emojiColor {
          opacity: 0;
          transition: opacity 380ms ease;
          text-shadow: 0 10px 18px rgba(0,0,0,0.14);
        }

        .emojiWrap.isActive {
          transform: scale(1);
          opacity: 1;
        }

        .emojiWrap.isActive .emojiGray { opacity: 0; }
        .emojiWrap.isActive .emojiColor { opacity: 1; }

        .emojiWrap.isPop {
          animation: pop 520ms cubic-bezier(0.2, 0.9, 0.2, 1) 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .emojiWrap, .emojiGray, .emojiColor {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
};

export default LoadingScreen;
