import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { config } from "../config";

const NAV_ITEMS = [
  { label: "Home", to: "/home", activeClass: "bg-[#F7DEE2]" },
  { label: "Timeline", to: "/timeline", activeClass: "bg-[#D8ECFF]" },
  { label: "See All", to: "/gallery", activeClass: "bg-[#FFE39F]" },
];

const Navbar = () => {
  const { logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    toast(config.logoutToast, "logout");
    // Small delay so the user sees the toast before redirect
    setTimeout(async () => {
      await logout();
    }, 200);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#EDEDED]/80 bg-white/90 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <p className="shrink-0 text-sm font-semibold tracking-wide text-[#3f3f3f] sm:text-base">
          {config.coupleDisplay}
        </p>
        <nav
          className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2 text-xs font-semibold text-[#666] sm:text-sm"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-2.5 py-1.5 sm:px-4 leading-tight transition-all duration-150 active:scale-95 touch-manipulation ${
                  isActive
                    ? `${item.activeClass} text-[#222] shadow-sm scale-105`
                    : "bg-white/40 text-[#666] hover:bg-white/70 hover:text-[#222] hover:scale-105"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="ml-1 rounded-full px-2.5 py-1.5 sm:px-4 leading-tight text-[#999] transition-all duration-150 hover:bg-[#FFE9F1] hover:text-[#555] active:scale-95 touch-manipulation"
            aria-label="Sign out"
          >
            <svg
              className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
