// src/components/layout/Navbar.tsx
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { config } from "../../config";

const NAV_ITEMS = [
  {
    label: "Timeline",
    to: "/timeline",
    activeClass: "bg-[#D8ECFF]",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
        className="w-5 h-5"
      >
        <rect x="4" y="3" width="16" height="8" />
        <polyline points="10,11 12,13.5 14,11" />
        <polyline points="4,17 3,18 4,19" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <polyline points="20,17 21,18 20,19" />
        <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Map",
    to: "/map",
    activeClass: "bg-[#CFE8E1]",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
        className="w-5 h-5"
      >
        <path d="M12 3c-3.3 0-6 2.6-6 5.8 0 4.3 6 12.2 6 12.2s6-7.9 6-12.2C18 5.6 15.3 3 12 3z" />
        <circle cx="12" cy="9" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Photos",
    to: "/photos",
    activeClass: "bg-[#FFE39F]",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
        className="w-5 h-5"
      >
        <rect x="3" y="4" width="18" height="16" />
        <polyline points="3,16 8,10 13,14 16,11 21,15" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Videos",
    to: "/videos",
    activeClass: "bg-[#F3D0D6]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <rect
          x="2"
          y="5"
          width="20"
          height="14"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <polygon points="10,9 10,15 16,12" fill="currentColor" />
      </svg>
    ),
  },
];

const HomeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    strokeLinejoin="miter"
    className="w-5 h-5"
  >
    <polyline points="3,12 12,4 21,12" />
    <polyline points="6,10 6,20 18,20 18,10" />
    <polyline points="9,20 9,14 15,14 15,20" />
  </svg>
);

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 40;
      setScrolled((prev) => (prev === next ? prev : next));
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Desktop navbar */}
      <header
        className="relative hidden sm:block sticky top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Gradient fade background */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 transition-all duration-300 ${
            scrolled ? "h-8" : "h-20"
          } bg-gradient-to-b from-[#FAFAF7] via-[#FAFAF7] to-transparent`}
          aria-hidden="true"
        />

        {/* Solid background + blur when scrolled */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            scrolled
              ? "opacity-100 bg-[#FAFAF7]/80 backdrop-blur-md"
              : "opacity-0"
          }`}
          aria-hidden="true"
        />

        <div className="relative z-10 flex w-full items-center justify-between px-4 py-2.5">
          <NavLink
            to="/"
            className="shrink-0 flex items-center gap-2 text-sm font-semibold tracking-wide text-[#3f3f3f] sm:text-base transition-colors duration-150 hover:text-[#000]"
          >
            <img
              src="/favicon-v2.png"
              alt="Gallery logo"
              className="h-8 w-8 select-none"
            />
            {config.brandDisplay}
          </NavLink>

          <nav
            className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#666]"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 pb-1 border-b-2 leading-tight transition-all duration-150 active:opacity-70 touch-manipulation ${
                    isActive
                      ? "border-[#222] text-[#222]"
                      : "border-transparent text-[#666] hover:text-[#222] hover:border-[#BDBDBD]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="app-bottom-nav sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#E0E0E0] bg-[#FAFAF7]"
        aria-label="Primary"
      >
        <div className="flex items-stretch">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center pt-4 pb-1 px-1 gap-1 text-[10px] font-semibold leading-tight transition-colors duration-150 active:opacity-60 touch-manipulation ${
                isActive ? "text-[#222]" : "text-[#999]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-3 right-3 h-[2px] bg-[#333]" />
                )}
                <HomeIcon />
                Home
              </>
            )}
          </NavLink>

          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center pt-4 pb-1 px-1 gap-1 text-[10px] font-semibold leading-tight transition-colors duration-150 active:opacity-60 touch-manipulation ${
                  isActive ? "text-[#222]" : "text-[#999]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-3 right-3 h-[2px] bg-[#333]" />
                  )}
                  {item.icon}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div
          className="w-full bg-[#FAFAF7]"
          style={{ height: "25px" }}
          aria-hidden="true"
        />
      </nav>
    </>
  );
};

export default Navbar;
