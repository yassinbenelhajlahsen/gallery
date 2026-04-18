// src/components/layout/Footer.tsx
import { NavLink } from "react-router-dom";

const Footer = () => {

  return (
    <footer
      className="mt-auto bg-linear-to-b from-transparent via-[#FAFAF7]/70 to-[#FAFAF7]"
      style={{ paddingBottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex flex-col items-center justify-center gap-1.5 px-4 pt-4 pb-4 text-xs text-[#aaa]">
        <div className="flex items-center gap-2">
          <NavLink
            to="/admin?tab=upload"
            className="mt-1 rounded-full px-2.5 py-1.5 leading-tight transition-all duration-150 sm:px-4 text-[#999] hover:bg-[#ECECEC] hover:text-[#444]"
            aria-label="Admin panel"
          >
            Upload
          </NavLink>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
