import { useEffect, useLayoutEffect } from "react";

export function useModalViewportLock(isOpen: boolean): void {
  // Dark status bar on iOS when modal is open
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const original = meta.getAttribute("content") ?? "#FAFAF7";
    if (isOpen) meta.setAttribute("content", "#000000");
    return () => { meta.setAttribute("content", original); };
  }, [isOpen]);

  // Scroll lock — prevent background scrolling without repositioning body
  useLayoutEffect(() => {
    if (!isOpen) return;

    const originalBg = document.documentElement.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#000000";
    document.documentElement.style.overflow = "hidden";

    // Prevent iOS Safari from scrolling behind the fixed modal
    const prevent = (e: TouchEvent) => { e.preventDefault(); };
    document.addEventListener("touchmove", prevent, { passive: false });

    return () => {
      document.documentElement.style.backgroundColor = originalBg;
      document.documentElement.style.overflow = "";
      document.removeEventListener("touchmove", prevent);
    };
  }, [isOpen]);
}
