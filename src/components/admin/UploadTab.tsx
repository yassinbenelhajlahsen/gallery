import { useRef } from "react";
import { useEventCreation } from "../../hooks/useEventCreation";
import { useUploadForm } from "../../hooks/useUploadForm";
import { useUploadOrchestrator } from "../../hooks/useUploadOrchestrator";
import { useUploadStaging, type StagingEntry } from "../../hooks/useUploadStaging";
import { FloatingInput } from "../ui/FloatingInput";

function StagingBadge({ entry }: { entry: StagingEntry | undefined }) {
  if (!entry) return null;
  if (entry.status === "staging") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#7a3b48]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#F3CED6]" />
        Uploading {entry.progress}%
      </span>
    );
  }
  if (entry.status === "staged") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2f5d4d]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9FC7B3]" />
        Ready
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8a2222]"
      title={entry.error}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E5A3A3]" />
      Failed
    </span>
  );
}

function StagingProgressBar({ entry }: { entry: StagingEntry | undefined }) {
  if (!entry || entry.status === "error") return null;
  return (
    <div className="relative mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          entry.status === "staged" ? "bg-[#9FC7B3]" : "bg-[#F3CED6]"
        }`}
        style={{ width: `${entry.progress}%` }}
      />
    </div>
  );
}

export default function AdminUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const eventCreation = useEventCreation();
  const form = useUploadForm(fileInputRef);
  const staging = useUploadStaging(form.files);
  const uploader = useUploadOrchestrator({
    files: form.files,
    fileMetaDates: form.fileMetaDates,
    date: form.date,
    dateSource: form.dateSource,
    eventName: form.eventName,
    clearForm: form.clearForm,
    commitAll: staging.commitAll,
  });

  const singleFile = form.files && form.files.length === 1 ? form.files[0] : null;
  const singleEntry = singleFile ? staging.entries[singleFile.name] : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-[#333]">
          Add New Media & Events
        </h2>
        <p className="text-sm text-[#666]">
          Upload images or videos and link them to a timeline event
        </p>
      </header>

      {/* File Input */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-[#333]">
          Select Media (Images / Videos)
          <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/quicktime,.mp4,.mov"
            onChange={form.handleFileInputChange}
            className="cursor-pointer w-full rounded-xl border-2 border-dashed border-[#F0F0F0] bg-[#FAFAF7] px-4 py-6 text-sm text-[#666] transition-all duration-200 hover:border-[#F7DEE2] hover:bg-white focus:border-[#F7DEE2] focus:outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#F7DEE2] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#333] file:transition-all file:duration-200 hover:file:bg-[#F3CED6]"
          />
          {form.files && form.files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.files.length === 1 && singleFile ? (
                <span className="inline-flex flex-col items-stretch gap-0.5 rounded-2xl border border-[#F0F0F0] bg-white px-2.5 py-1.5 text-xs text-[#555]">
                  <span className="flex items-center gap-1.5">
                    <span className="max-w-[200px] truncate">{singleFile.name}</span>
                    <button
                      type="button"
                      onClick={() => form.handleRemoveFile(singleFile.name)}
                      className="cursor-pointer text-[#aaa] hover:text-[#333] transition-colors"
                      aria-label="Remove file"
                    >
                      ✕
                    </button>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <StagingBadge entry={singleEntry} />
                    {singleEntry?.status === "error" && (
                      <button
                        type="button"
                        onClick={() => staging.retry(singleFile.name)}
                        className="cursor-pointer text-[10px] font-medium text-[#7a3b48] underline hover:text-[#5a2b38]"
                      >
                        Retry
                      </button>
                    )}
                  </span>
                  <StagingProgressBar entry={singleEntry} />
                </span>
              ) : (
                <p className="text-xs text-[#888]">{form.files.length} files selected</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Per-file date table — only shown for multiple files */}
      {form.files && form.files.length > 1 && (
        <div className="space-y-3 rounded-xl border-2 border-[#F0F0F0] bg-[#FAFAF7] p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#333]">Files</p>
            {form.isReadingMeta && (
              <span className="flex items-center gap-1.5 text-xs text-[#888]">
                <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Reading metadata…
              </span>
            )}
          </div>

          {!form.isReadingMeta && (
            <>
              <div className="overflow-hidden rounded-lg border border-[#F0F0F0] bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F0F0F0] bg-[#FAFAF7]">
                      <th className="px-3 py-2 text-left font-semibold text-[#555]">File</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#555]">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#555]">Status</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.files.map((file) => {
                      const cellDate =
                        form.dateSource === "event" ? form.date : (form.fileMetaDates[file.name] ?? "");
                      const entry = staging.entries[file.name];

                      return (
                        <tr key={file.name} className="border-b border-[#F0F0F0] last:border-0">
                          <td className="max-w-[140px] truncate px-3 py-2 font-medium text-[#333]">
                            {file.name}
                          </td>
                          <td className="px-3 py-1.5">
                            {form.dateSource === "event" ? (
                              <span className="text-[#555]">{cellDate}</span>
                            ) : (
                              <input
                                type="date"
                                value={cellDate}
                                onChange={(e) =>
                                  form.setFileMetaDates((prev) => ({
                                    ...prev,
                                    [file.name]: e.target.value || null,
                                  }))
                                }
                                className="w-full rounded-lg border border-[#F0F0F0] bg-white px-2 py-1 text-xs text-[#333] hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none"
                              />
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <StagingBadge entry={entry} />
                                {entry?.status === "error" && (
                                  <button
                                    type="button"
                                    onClick={() => staging.retry(file.name)}
                                    className="cursor-pointer text-[10px] font-medium text-[#7a3b48] underline hover:text-[#5a2b38]"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                              <StagingProgressBar entry={entry} />
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => form.handleRemoveFile(file.name)}
                              className="cursor-pointer text-[#bbb] hover:text-red-400 transition-colors"
                              aria-label={`Remove ${file.name}`}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {form.dateSource !== "event" && (() => {
                const missingCount = form.files!.filter(
                  (f) => !form.fileMetaDates[f.name],
                ).length;
                return missingCount > 0 ? (
                  <p className="text-xs font-medium text-amber-700">
                    ⚠ {missingCount} file{missingCount === 1 ? "" : "s"} {missingCount === 1 ? "has" : "have"} no date — edit in the table above.
                  </p>
                ) : null;
              })()}
            </>
          )}
        </div>
      )}

      <div className="h-px bg-linear-to-r from-transparent via-[#F0F0F0] to-transparent" />

      {/* Event Selection Dropdown */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-[#333]">
          Link to Timeline Event
        </label>
        <select
          value={form.selectedEventId}
          onChange={(e) => form.handleEventSelect(e.target.value)}
          className="cursor-pointer pt-4.5 pb-4.5 w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
        >
          <option value="">Select an event (optional)</option>
          {form.sortedEvents.map((event) => {
            const [year, month, day] = event.date.split("-").map(Number);
            const eventDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
            const formattedDate = eventDate.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            return (
              <option key={event.id} value={event.id}>
                {event.title} - {formattedDate}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-[#888]">
          Select an event to automatically fill date and label, or enter
          custom details below
        </p>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <FloatingInput
          id="label"
          type="text"
          label="Label"
          className="w-full"
          value={form.eventName}
          onChange={(e) => form.handleEventNameChange(e.target.value)}
          focusColor="#F7DEE2"
          borderColor="#F0F0F0"
          labelColor="#333"
        />
        <p className="text-xs text-[#888]">
          A label for this media. If it matches an existing timeline event's
          name, it will be linked automatically.
        </p>
      </div>

      {/* Date Input — hidden when multiple files are selected (each file has its own date in the table above) */}
      {(!form.files || form.files.length <= 1) && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[#333]">
            Date{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => form.handleDateChange(e.target.value)}
            className="
                  pt-4.5
                  pb-4.5
                  w-full
                  min-w-0
                  appearance-none
                  box-border
                  rounded-xl
                  border-2 border-[#F0F0F0]
                  bg-white
                  px-4 py-3
                  text-[#333]
                  shadow-sm
                  transition-all duration-200
                  hover:border-[#F7DEE2]
                  focus:border-[#F7DEE2]
                  focus:outline-none
                  focus:ring-2 focus:ring-[#F7DEE2]/30
                "
          />
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={uploader.handleUpload}
        disabled={
          uploader.isUploading ||
          !form.files ||
          form.files.length === 0 ||
          form.isReadingMeta ||
          staging.isStaging ||
          !staging.hasStagedAny ||
          (form.files.length === 1 &&
            !form.date &&
            !form.fileMetaDates[form.files[0]?.name ?? ""])
        }
        className="cursor-pointer w-full rounded-xl bg-[#F7DEE2] py-4 font-semibold text-[#333] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F3CED6] hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 touch-manipulation"
      >
        {uploader.isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Publishing…
          </span>
        ) : staging.isStaging ? (
          "Uploading… (waiting for media)"
        ) : (
          "Upload Media"
        )}
      </button>

      {/* Error Alert */}
      {uploader.error && (
        <div className="rounded-xl border border-[#f1dada] bg-[#ffebeb] p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#7d1f1f]">Upload failed</p>
          <p className="mt-1 text-sm text-[#8a2222]">{uploader.error}</p>
        </div>
      )}

      {/* Per-file commit results — visible briefly during/after Publish */}
      {uploader.uploadProgress.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-[#F0F0F0] bg-[#FAFAF7] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#333]">
              Publish Progress
            </h2>
            <span className="rounded-full bg-[#F7DEE2] px-3 py-1 text-xs font-semibold text-[#333]">
              {uploader.uploadProgress.filter((p) => p.status === "success").length} /{" "}
              {uploader.uploadProgress.length}
            </span>
          </div>

          <div className="space-y-3">
            {uploader.uploadProgress.map((item) => {
              const pillClasses =
                item.status === "success"
                  ? "bg-[#E7F1EC] text-[#2f5d4d]"
                  : item.status === "error"
                    ? "bg-[#ffebeb] text-[#8a2222]"
                    : "bg-[#F7DEE2] text-[#7a3b48]";

              const statusLabel =
                item.status === "success"
                  ? "Done"
                  : item.status === "error"
                    ? "Failed"
                    : "Publishing";

              const barClasses =
                item.status === "success"
                  ? "bg-[#9FC7B3]"
                  : item.status === "error"
                    ? "bg-[#E5A3A3]"
                    : "bg-[#F3CED6]";

              return (
                <div
                  key={item.fileName}
                  className="space-y-2 rounded-xl border border-[#F0F0F0] bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex-1 truncate text-sm font-medium text-[#333]">
                      {item.fileName}
                    </p>
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${pillClasses}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barClasses}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-[#888]">
                      {item.progress}%
                    </p>
                    {item.error && (
                      <p className="truncate text-xs font-medium text-[#8a2222]">
                        {item.error}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-px bg-linear-to-r from-transparent via-[#F0F0F0] to-transparent" />

      {/* Create New Event */}
      <div className="space-y-4 rounded-xl border-2 border-[#F0F0F0] bg-[#FAFAF7] p-5">
        <h2 className="text-lg font-semibold text-[#333]">Create New Event</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#333]">
              Date{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={eventCreation.newEventDate}
              onChange={(e) => eventCreation.setNewEventDate(e.target.value)}
              className="
                    pt-4.5
                    pb-4.5
                    w-full
                    min-w-0
                    appearance-none
                    box-border
                    rounded-xl
                    border-2 border-[#F0F0F0]
                    bg-white
                    px-4 py-3
                    text-[#333]
                    shadow-sm
                    transition-all duration-200
                    hover:border-[#F7DEE2]
                    focus:border-[#F7DEE2]
                    focus:outline-none
                    focus:ring-2 focus:ring-[#F7DEE2]/30
                  "
            />
          </div>
          <div className="space-y-2 mt-7">
            <FloatingInput
              id="new-event-title"
              type="text"
              label="Title*"
              className="w-full"
              value={eventCreation.newEventTitle}
              onChange={(e) => eventCreation.setNewEventTitle(e.target.value)}
              focusColor="#F7DEE2"
              borderColor="#F0F0F0"
              labelColor="#333"
            />
          </div>
          <div className="space-y-2 mt-7">
            <FloatingInput
              id="new-event-emoji"
              type="text"
              label="Emoji"
              className="w-full"
              value={eventCreation.newEventEmoji}
              onChange={(e) => eventCreation.setNewEventEmoji(e.target.value)}
              focusColor="#F7DEE2"
              borderColor="#F0F0F0"
              labelColor="#333"
            />
          </div>
        </div>
        <button
          onClick={eventCreation.handleCreateEvent}
          disabled={eventCreation.isCreatingEvent || !eventCreation.newEventDate || !eventCreation.newEventTitle.trim()}
          className="cursor-pointer w-full rounded-xl mt-3 bg-[#F7DEE2] py-3 font-semibold text-[#333] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F3CED6] hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 touch-manipulation"
        >
          {eventCreation.isCreatingEvent ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating…
            </span>
          ) : (
            "Create Event"
          )}
        </button>
      </div>
    </div>
  );
}
