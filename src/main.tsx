// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Block iOS double-tap-to-zoom and multi-touch pinch gestures. The viewport
// meta tag's user-scalable=no is ignored by iOS Safari (including installed
// PWAs), so these listeners are the only reliable way to disable zoom there.
document.addEventListener("gesturestart", (e) => e.preventDefault());

let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

// Block the iOS PWA/Safari horizontal edge-swipe that triggers history
// back/forward. CSS touch-action does not block this gesture; the only
// reliable way is a non-passive touchstart listener that preventDefaults
// when the touch starts within ~20px of either viewport edge.
// Requires iOS Safari 13.4+. Does not affect inner React touch handlers
// (they still fire — only the browser's default edge-swipe is cancelled).
document.addEventListener(
  "touchstart",
  (e) => {
    const x = e.touches[0]?.pageX ?? 0;
    if (x > 20 && x < window.innerWidth - 20) return;
    e.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
