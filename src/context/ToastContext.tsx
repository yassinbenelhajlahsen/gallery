/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";

type ToastVariant = "success" | "error" | "logout";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

const TOAST_DURATION = 3500;

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "logout") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION);
    },
    [],
  );

  const value = useMemo(() => ({ toast: addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

/* ── Visual layer ── */

const variantStyles: Record<ToastVariant, string> = {
  success:
    "bg-white/90 border-[#c6f0c6] text-[#2d6a2d] shadow-[0_8px_30px_rgba(100,200,100,0.2)]",
  error:
    "bg-white/90 border-[#f5c6c6] text-[#8b2222] shadow-[0_8px_30px_rgba(200,100,100,0.2)]",
  logout:
    "bg-white/90 border-[#D8ECFF] text-[#333] shadow-[0_8px_30px_rgba(180,210,255,0.25)]",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  logout: "👋",
};

const ToastContainer: React.FC<{ toasts: Toast[] }> = ({ toasts }) => {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-0 right-0 z-100 flex flex-col items-center gap-3 px-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto animate-[toastSlideUp_0.35s_ease-out] rounded-2xl border px-5 py-3 text-sm font-semibold backdrop-blur-lg transition-all ${variantStyles[t.variant]}`}
          role="status"
        >
          <span className="mr-2" aria-hidden="true">
            {variantIcons[t.variant]}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
};
