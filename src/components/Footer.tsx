import { config } from "../config";

const Footer = () => {
  return (
    <footer className="mt-auto border-t border-[#F0EDE8]/60 bg-white/50 backdrop-blur-sm">
      <div className="mx-auto flex items-center justify-center gap-1.5 px-4 py-4 text-xs text-[#aaa]">
        <span>Made with</span>
        <span className="text-[#F7889D]" aria-label="love">
          ♥
        </span>
        <span>for {config.coupleDisplay}</span>
      </div>
    </footer>
  );
};

export default Footer;
