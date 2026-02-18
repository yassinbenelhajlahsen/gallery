import { useEffect } from "react";
import { createPortal } from "react-dom";

export type DeleteConfirmModalDraft = {
  kind: "image" | "video" | "event";
  title: string;
};

type DeleteConfirmModalProps = {
  draft: DeleteConfirmModalDraft | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({
  draft,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!draft || isDeleting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, isDeleting, onClose]);

  useEffect(() => {
    if (!draft || typeof document === "undefined") return;

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarGap = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [draft]);

  const portalTarget = typeof document === "undefined" ? null : document.body;
  if (!draft || !portalTarget) return null;

  const itemTypeLabel =
    draft.kind === "event"
      ? "Timeline Event"
      : draft.kind === "image"
        ? "Image"
        : "Video";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-[#2f1f26]/55 px-4 py-6 backdrop-blur-sm"
      style={{ animation: "modalBackdropReveal 0.25s ease-out forwards" }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#f1d8df] bg-white shadow-[0_35px_90px_rgba(53,18,34,0.34)]"
          style={{
            animation:
              "modalCardReveal 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) forwards",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[#f5e1e7] bg-linear-to-r from-[#fff6f9] via-[#fffefe] to-[#fff2f6] px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center rounded-full bg-[#F7DEE2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b4658]">
                  {itemTypeLabel}
                </span>
                <h3 className="text-xl font-semibold text-[#332a2e]">
                  Confirm Delete
                </h3>
                <p className="truncate text-sm text-[#7a6970]">{draft.title}</p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-2 px-5 py-5 sm:px-6">
            <p className="text-sm text-[#4f4348]">
              This will permanently delete this {draft.kind}.
            </p>
            <p className="text-sm text-[#7a6970]">This action cannot be undone.</p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#f5e1e7] bg-[#fffbfc] px-5 py-4 sm:px-6">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="cursor-pointer rounded-full bg-[#efefef] px-4 py-2 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="cursor-pointer rounded-full bg-[#F7DEE2] px-4 py-2 text-xs font-semibold text-[#333] shadow-sm transition hover:bg-[#F3CED6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
