// src/components/layout/Navbar.tsx
import { NavLink } from "react-router-dom";
import { config } from "../../config";

const NAV_ITEMS = [
  {
    label: "Timeline",
    to: "/timeline",
    activeClass: "bg-[#D8ECFF]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    ),
  },
  {
    label: "Photos",
    to: "/photos",
    activeClass: "bg-[#FFE39F]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <polyline points="21 15 16 10 5 19" />
      </svg>
    ),
  },
  {
    label: "Videos",
    to: "/videos",
    activeClass: "bg-[#F3D0D6]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="6" width="15" height="12" rx="2" />
        <polyline points="17 10 22 7 22 17 17 14" />
      </svg>
    ),
  },
];

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 12L12 4l9 8" />
    <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
  </svg>
);

const Navbar = () => {
  return (
    <>
      {/* Desktop top navbar — hidden on mobile */}
      <header
        className="hidden sm:block sticky top-0 z-20 border-b border-[#EDEDED]/80 bg-white/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex w-full items-center justify-between px-4 py-3">
          <NavLink
            to="/"
            className="shrink-0 flex items-center gap-2 text-sm font-semibold tracking-wide text-[#3f3f3f] sm:text-base rounded-full px-2.5 py-2 transition-all duration-150 active:scale-95 touch-manipulation hover:scale-105"
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
                  `rounded-full px-4 py-2 leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
                    isActive
                      ? `${item.activeClass} text-[#222] shadow-sm scale-105`
                      : "bg-white/40 text-[#666] hover:bg-white/70 hover:text-[#222] hover:scale-105"
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
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-[#EDEDED]/80"
        aria-label="Primary"
      >
        <div className="flex items-stretch">
          {/* Home tab */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 pt-3 pb-2 px-1 text-[10px] font-semibold leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
                isActive ? "text-[#222]" : "text-[#999]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-xl p-1.5 transition-all duration-150 ${isActive ? "bg-[#F9A1B2] scale-105 shadow-sm" : ""}`}>
                  <HomeIcon />
                </span>
                Home
              </>
            )}
          </NavLink>

          {/* Other nav tabs */}
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 pt-3 pb-2 px-1 text-[10px] font-semibold leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
                  isActive ? "text-[#222]" : "text-[#999]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`rounded-xl p-1.5 transition-all duration-150 ${isActive ? `${item.activeClass} scale-105 shadow-sm` : ""}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
        {/* Safe-area fill — extends bg colour into the home indicator zone */}
        <div
          className="w-full bg-white/90"
          style={{ height: "env(safe-area-inset-bottom)" }}
          aria-hidden="true"
        />
      </nav>
    </>
  );
};

export default Navbar;
