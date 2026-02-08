// src/components/Navbar.tsx
import { NavLink } from "react-router-dom";
import { config } from "../config";

const NAV_ITEMS = [
  { label: "Timeline", to: "/timeline", activeClass: "bg-[#D8ECFF]" },
  { label: "Photos", to: "/photos", activeClass: "bg-[#FFE39F]" },
  { label: "Videos", to: "/videos", activeClass: "bg-[#F3D0D6]" },
  { label: "Upload", to: "/upload", activeClass: "bg-[#C0C0C0]/70" },
];

const Navbar = () => {
  return (
    <header className="sticky top-0 z-20 border-b border-[#EDEDED]/80 bg-white/90 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <NavLink
          to="/home"
          className="hidden sm:block shrink-0 text-sm font-semibold tracking-wide text-[#3f3f3f] sm:text-base rounded-full px-2.5 py-2 transition-all duration-150 active:scale-95 touch-manipulation hover:scale-105"
        >
          {config.coupleDisplay}
        </NavLink>
        <nav
          className="flex flex-wrap shrink-0 items-center justify-end gap-2 sm:gap-2 text-sm font-semibold text-[#666] sm:text-sm"
          aria-label="Primary"
        >
          <div className="block sm:hidden">
            <NavLink
              to="/home"
              className={({ isActive }) =>
                `rounded-full px-2.5 py-2 sm:px-4 leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
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
                `rounded-full px-2.5 py-2 sm:px-4 leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
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
