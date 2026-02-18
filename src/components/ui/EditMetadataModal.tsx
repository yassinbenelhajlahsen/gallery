import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FloatingInput } from "./FloatingInput";

export type MediaEditDraft = {
  kind: "image" | "video";
  id: string;
  date: string;
  event: string;
  caption?: string;
};

export type EventEditDraft = {
  kind: "event";
  id: string;
  originalTitle: string;
  mediaIds: string[];
  date: string;
  title: string;
  emojiOrDot: string;
};

export type EditDraft = MediaEditDraft | EventEditDraft;

type EditMetadataModalProps = {
  draft: EditDraft | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (nextDraft: EditDraft) => void;
};

const PINK_FOCUS = "#F3CED6";
const PINK_BORDER = "#F4DDE4";
const PINK_LABEL = "#7f5a66";

export default function EditMetadataModal({
  draft,
  isSaving,
  onClose,
  onSave,
  onChange,
}: EditMetadataModalProps) {
  useEffect(() => {
    if (!draft || isSaving) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, isSaving, onClose]);

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
          aria-label="Edit metadata"
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
                <h3 className="text-xl font-semibold text-[#332a2e]">Edit Metadata</h3>
                <p className="truncate text-sm text-[#7a6970]">
                  {draft.kind === "event" ? draft.title : draft.id}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-5 sm:px-6">
            <FloatingInput
              id="edit-meta-date"
              type="date"
              label="Date"
              value={draft.date}
              onChange={(event) => onChange({ ...draft, date: event.target.value })}
              required={false}
              focusColor={PINK_FOCUS}
              borderColor={PINK_BORDER}
              labelColor={PINK_LABEL}
            />

            {draft.kind === "event" ? (
              <>
                <FloatingInput
                  id="edit-meta-title"
                  type="text"
                  label="Title"
                  value={draft.title}
                  onChange={(event) =>
                    onChange({ ...draft, title: event.target.value })
                  }
                  required={false}
                  focusColor={PINK_FOCUS}
                  borderColor={PINK_BORDER}
                  labelColor={PINK_LABEL}
                />
                <FloatingInput
                  id="edit-meta-emoji"
                  type="text"
                  label="Emoji / Dot"
                  value={draft.emojiOrDot}
                  onChange={(event) =>
                    onChange({ ...draft, emojiOrDot: event.target.value })
                  }
                  required={false}
                  focusColor={PINK_FOCUS}
                  borderColor={PINK_BORDER}
                  labelColor={PINK_LABEL}
                />
              </>
            ) : (
              <>
                <FloatingInput
                  id="edit-meta-event"
                  type="text"
                  label="Event"
                  value={draft.event}
                  onChange={(event) =>
                    onChange({ ...draft, event: event.target.value })
                  }
                  required={false}
                  focusColor={PINK_FOCUS}
                  borderColor={PINK_BORDER}
                  labelColor={PINK_LABEL}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#f5e1e7] bg-[#fffbfc] px-5 py-4 sm:px-6">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="cursor-pointer rounded-full bg-[#efefef] px-4 py-2 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e4e4e4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className="cursor-pointer rounded-full bg-[#F7DEE2] px-4 py-2 text-xs font-semibold text-[#333] shadow-sm transition hover:bg-[#F3CED6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
