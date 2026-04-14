// src/pages/LoadingScreen.tsx
const LoadingScreen = () => {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#FAFAF7] px-4">
      {/* Sloths centerpiece (transparent PNG, no card, no animation) */}
      <img
        src="/favicon-v2.png"
        alt=""
        width={192}
        height={192}
        loading="eager"
        decoding="async"
        className="h-44 w-44 select-none sm:h-56 sm:w-56"
      />

      {/* Static "Loading..." label */}
      <p
        className="font-display text-2xl tracking-wide text-[#888] sm:text-2xl"
        role="status"
        aria-live="polite"
      >
        Loading...
      </p>

      {/* Bouncing bubbles — pink, blue, yellow */}
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        <span
          className="h-4 w-4 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-[#FACAD5] sm:h-5 sm:w-5"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="h-4 w-4 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-[#D8ECFF] sm:h-5 sm:w-5"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="h-4 w-4 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-[#FFE89D] sm:h-5 sm:w-5"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </section>
  );
};

export default LoadingScreen;
