import React from "react";

export type TimelineEvent = {
  id: string;
  date: string; // ISO string
  title: string;
  emojiOrDot?: string;
  imageIds?: string[];
};

export type TimelineEventItemProps = {
  event: TimelineEvent;
  onSelect: (event: TimelineEvent) => void;
  linkedImageCount?: number;
};

const TimelineEventItem: React.FC<TimelineEventItemProps> = ({
  event,
  onSelect,
  linkedImageCount = 0,
}) => {
  const hasImages = linkedImageCount > 0;
  const toLocalDate = (isoDate: string) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  };
  return (
    <button
      type="button"
      onClick={() => hasImages && onSelect(event)}
      disabled={!hasImages}
      className={`group flex w-full gap-4 rounded-3xl border px-5 py-4 text-left shadow-sm transition-all duration-200
        ${
          hasImages
            ? "border-[#F0F0F0] bg-white/80 hover:scale-[1.01] hover:border-[#F7DEE2] hover:shadow-md active:scale-[0.99] touch-manipulation"
            : "cursor-not-allowed border-dashed border-[#E5E4E4] bg-white/60 opacity-70"
        }`}
      style={hasImages ? { willChange: "transform" } : undefined}
    >
      <div className="flex flex-col items-center justify-center text-2xl">
        <span className="text-3xl" aria-hidden="true">
          {event.emojiOrDot ?? "•"}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#999]">
          {toLocalDate(event.date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="text-lg font-semibold text-[#333]">{event.title}</p>
        {hasImages ? (
          <p className="text-sm text-[#5e5e5e]">
            {linkedImageCount} photo{linkedImageCount === 1 ? "" : "s"} linked
          </p>
        ) : (
          <p className="text-sm text-[#b2b0b0]">No Media Available</p>
        )}
      </div>
    </button>
  );
};

export default TimelineEventItem;
