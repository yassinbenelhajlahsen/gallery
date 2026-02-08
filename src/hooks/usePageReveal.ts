// src/hooks/usePageReveal.ts
import { useEffect, useState } from "react";

/**
 * Provides a simple fade/slide-in flag for page-level transitions.
 * Returns a boolean that flips to true shortly after mount so components
 * can attach CSS transitions without layout thrash.
 */
export const usePageReveal = (delay = 20) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let animationFrame: number;
    const timeout = window.setTimeout(() => {
      animationFrame = window.requestAnimationFrame(() => setIsVisible(true));
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [delay]);

  return isVisible;
};

export default usePageReveal;
