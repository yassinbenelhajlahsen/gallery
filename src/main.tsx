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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
