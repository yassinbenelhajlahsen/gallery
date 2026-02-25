// src/components/layout/Navbar.tsx
import { NavLink } from "react-router-dom";
import { config } from "../../config";

const NAV_ITEMS = [
  { label: "Timeline", to: "/timeline", activeClass: "bg-[#D8ECFF]" },
  { label: "Photos", to: "/photos", activeClass: "bg-[#FFE39F]" },
  { label: "Videos", to: "/videos", activeClass: "bg-[#F3D0D6]" },
];

const Navbar = () => {
  return (
    <header className="sticky top-0 z-20 border-b border-[#EDEDED]/80 bg-white/90 backdrop-blur-md">
      <div className="flex w-full items-center justify-center gap-3 px-2 py-3 sm:px-4 sm:justify-between">
        <NavLink
          to="/"
          className="hidden sm:flex shrink-0 items-center gap-2 text-sm font-semibold tracking-wide text-[#3f3f3f] sm:text-base rounded-full px-2.5 py-2 transition-all duration-150 active:scale-95 touch-manipulation hover:scale-105"
        >
          <img
            src="/favicon-v2.png"
            alt="Gallery logo"
            className="h-8 w-8 select-none"
          />
          {config.coupleDisplay}
        </NavLink>
        <nav
          className="flex w-full flex-nowrap items-center justify-center gap-8 text-xs font-semibold text-[#666] sm:w-auto sm:shrink-0 sm:justify-end sm:gap-2 sm:text-sm"
          aria-label="Primary"
        >
          <div className="block sm:hidden">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-center sm:px-4 sm:py-2 leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
                  isActive
                    ? `bg-[#F9A1B2] text-[#222] shadow-sm scale-105`
                    : "bg-white/40 text-[#666] hover:bg-white/70 hover:text-[#222] hover:scale-105"
                }`
              }
            >
              Home
            </NavLink>
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 sm:px-4 sm:py-2 leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
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
  );
};

export default Navbar;
