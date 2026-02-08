// src/components/Footer.tsx
import { config } from "../config";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const Footer = () => {
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
    <footer className="mt-auto bg-linear-to-b from-white/0 via-white/70 to-white backdrop-blur-sm">
      <div className="mx-auto flex flex-col items-center justify-center gap-1.5 px-4 py-4 text-xs text-[#aaa]">
        <div className="flex items-center gap-1.5">
          <span>Made with</span>
          <span className="text-[#F7889D]" aria-label="love">
            ♥
          </span>
          <span>for {config.coupleDisplay}</span>
        </div>

        <div>
          <button
            type="button"
            onClick={handleLogout}
            className="cursor-pointer mt-1 rounded-full px-2.5 py-1.5 sm:px-4 leading-tight text-[#999] transition-all duration-150 hover:bg-[#FFE9F1] hover:text-[#555] active:scale-95 touch-manipulation"
            aria-label="Sign out"
          >
            Logout
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
