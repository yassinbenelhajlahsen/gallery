// src/components/admin/AdminUploadPage.tsx
import { useState, useMemo, useRef } from "react";
import { useGallery } from "../../context/GalleryContext";
import { useToast } from "../../context/ToastContext";
import { FloatingInput } from "../ui/FloatingInput";
import { isVideoFile } from "../../utils/uploadMediaUtils";
import { inferUploadDateFromMetadata } from "../../utils/uploadDateMetadata";
import {
  createTimelineEvent,
  uploadImageWithMetadata,
  uploadVideoWithMetadata,
} from "../../services/uploadService";

interface UploadProgress {
  fileName: string;
  status: "pending" | "converting" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  url?: string;
}

export default function AdminUploadPage() {
  const [files, setFiles] = useState<File[] | null>(null);
  const [date, setDate] = useState("");
  const [dateSource, setDateSource] = useState<"none" | "event" | "metadata" | "manual">(
    "none",
  );
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [eventName, setEventName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileMetaDates, setFileMetaDates] = useState<Record<string, string | null>>({});
  const [isReadingMeta, setIsReadingMeta] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State for creating new event
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventEmoji, setNewEventEmoji] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  const { events, refreshEvents, refreshGallery } = useGallery();
  const metadataProbeIdRef = useRef(0);
  const dateSourceRef = useRef(dateSource);

  dateSourceRef.current = dateSource;

  // Sort events by date (newest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [events]);

  // Handle creating a new event
  const handleCreateEvent = async () => {
    if (!newEventDate || !newEventTitle.trim()) {
      toast("Please fill in date and title.", "error");
      return;
    }

    setIsCreatingEvent(true);
    try {
      await createTimelineEvent(newEventDate, newEventTitle, newEventEmoji);

      // Refresh events to include the new one
      await refreshEvents();

      toast("Event created successfully!", "success");

      // Clear form
      setNewEventDate("");
      setNewEventEmoji("");
      setNewEventTitle("");
    } catch (err) {
      console.error("Failed to create event:", err);
      toast("Failed to create event. Please try again.", "error");
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const probeFilesMetadata = async (filesToProbe: File[]) => {
    const probeId = metadataProbeIdRef.current + 1;
    metadataProbeIdRef.current = probeId;
    setIsReadingMeta(true);
    const dates = await Promise.all(filesToProbe.map((f) => inferUploadDateFromMetadata(f)));
    if (metadataProbeIdRef.current !== probeId) return;
    const metaMap: Record<string, string | null> = {};
    filesToProbe.forEach((f, i) => { metaMap[f.name] = dates[i] ?? null; });
    setFileMetaDates(metaMap);
    setIsReadingMeta(false);
  };

  // Auto-fill date and event name when an event is selected
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    if (!eventId) {
      setDate("");
      setDateSource("none");
      setEventName("");
      if (files && files.length > 0) void probeFilesMetadata(files);
      return;
    }
    const event = sortedEvents.find((e) => e.id === eventId);
    if (event) {
      setDate(event.date);
      setDateSource("event");
      setEventName(event.title);
    }
  };

  // Clear event selection when manually changing date or event name
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setDateSource(newDate ? "manual" : "none");
    setSelectedEventId("");
  };

  const handleEventNameChange = (newName: string) => {
    setEventName(newName);
    setSelectedEventId("");
  };

  const handleRemoveFile = (fileName: string) => {
    setFiles((prev) => {
      const next = prev ? prev.filter((f) => f.name !== fileName) : null;
      return next && next.length > 0 ? next : null;
    });
    setFileMetaDates((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    // Clear the native input so re-selecting the same files triggers onChange again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = event.target.files;
    setFiles(selectedFiles ? Array.from(selectedFiles) : null);
    setFileMetaDates({});

    if (!selectedFiles || selectedFiles.length === 0) return;

    // Event selection takes precedence — skip metadata probing entirely.
    if (dateSourceRef.current === "event") return;

    await probeFilesMetadata(Array.from(selectedFiles));
  };

  const updateProgress = (
    fileName: string,
    updates: Partial<UploadProgress>,
  ) => {
    setUploadProgress((prev) => {
      const existing = prev.find((p) => p.fileName === fileName);
      if (existing) {
        return prev.map((p) =>
          p.fileName === fileName ? { ...p, ...updates } : p,
        );
      }
      return [
        ...prev,
        {
          fileName,
          status: "pending",
          progress: 0,
          ...updates,
        },
      ];
    });
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);
    const results: string[] = [];

    // Initialize upload progress entries so the UI shows 0/TOTAL at start
    const filesArr = files;
    setUploadProgress(
      filesArr.map((f) => ({
        fileName: f.name,
        status: "pending",
        progress: 0,
      })),
    );

    try {
      for (const originalFile of filesArr) {
        const fileName = originalFile.name;

        const effectiveDate =
          dateSource === "event"
            ? date
            : (fileMetaDates[originalFile.name] ?? date);

        if (!effectiveDate) {
          updateProgress(fileName, {
            status: "error",
            error: "No date — set a Fallback Date above",
            progress: 0,
          });
          continue;
        }

        updateProgress(fileName, { status: "converting", progress: 10 });

        try {
          if (isVideoFile(originalFile)) {
            updateProgress(fileName, { progress: 20 });
            updateProgress(fileName, { status: "uploading", progress: 60 });
            const { url } = await uploadVideoWithMetadata(
              originalFile,
              effectiveDate,
              eventName,
            );
            updateProgress(fileName, { progress: 100, status: "success", url });
            results.push(url);
          } else {
            updateProgress(fileName, { progress: 20 });
            updateProgress(fileName, { status: "uploading", progress: 60 });
            const { url } = await uploadImageWithMetadata(
              originalFile,
              effectiveDate,
              eventName,
            );
            updateProgress(fileName, { progress: 100, status: "success", url });
            results.push(url);
          }
        } catch (fileError) {
          const errorMessage =
            fileError instanceof Error ? fileError.message : String(fileError);
          console.error(`[Upload] ✗ Failed to upload ${fileName}:`, fileError);
          updateProgress(fileName, {
            status: "error",
            error: errorMessage,
            progress: 0,
          });
        }
      }

      if (results.length === 0) {
        setError("No files were successfully uploaded");
        return;
      }

      toast(
        `${results.length} upload${results.length === 1 ? "" : "s"} completed successfully!`,
        "success",
      );
      // Refresh gallery to show new uploads
      await refreshGallery();
      // Reset inputs and progress after successful upload(s)
      if (fileInputRef && fileInputRef.current) fileInputRef.current.value = "";
      setFiles(null);
      setDate("");
      setDateSource("none");
      setSelectedEventId("");
      setEventName("");
      setUploadProgress([]);
      setFileMetaDates({});
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      console.error(`[Upload] Fatal error:`, err);
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

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
            onChange={handleFileInputChange}
            className="cursor-pointer w-full rounded-xl border-2 border-dashed border-[#F0F0F0] bg-[#FAFAF7] px-4 py-6 text-sm text-[#666] transition-all duration-200 hover:border-[#F7DEE2] hover:bg-white focus:border-[#F7DEE2] focus:outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#F7DEE2] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#333] file:transition-all file:duration-200 hover:file:bg-[#F3CED6]"
          />
          {files && files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.length === 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0F0F0] bg-white px-2.5 py-1 text-xs text-[#555]">
                  <span className="max-w-[200px] truncate">{files[0]?.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(files[0]?.name ?? "")}
                    className="cursor-pointer text-[#aaa] hover:text-[#333] transition-colors"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <p className="text-xs text-[#888]">{files.length} files selected</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Per-file date table — only shown for multiple files */}
      {files && files.length > 1 && (
        <div className="space-y-3 rounded-xl border-2 border-[#F0F0F0] bg-[#FAFAF7] p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#333]">Files</p>
            {isReadingMeta && (
              <span className="flex items-center gap-1.5 text-xs text-[#888]">
                <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Reading metadata…
              </span>
            )}
          </div>

          {!isReadingMeta && (
            <>
              <div className="overflow-hidden rounded-lg border border-[#F0F0F0] bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F0F0F0] bg-[#FAFAF7]">
                      <th className="px-3 py-2 text-left font-semibold text-[#555]">File</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#555]">Date</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => {
                      const cellDate =
                        dateSource === "event" ? date : (fileMetaDates[file.name] ?? "");

                      return (
                        <tr key={file.name} className="border-b border-[#F0F0F0] last:border-0">
                          <td className="max-w-[140px] truncate px-3 py-2 font-medium text-[#333]">
                            {file.name}
                          </td>
                          <td className="px-3 py-1.5">
                            {dateSource === "event" ? (
                              <span className="text-[#555]">{cellDate}</span>
                            ) : (
                              <input
                                type="date"
                                value={cellDate}
                                onChange={(e) =>
                                  setFileMetaDates((prev) => ({
                                    ...prev,
                                    [file.name]: e.target.value || null,
                                  }))
                                }
                                className="w-full rounded-lg border border-[#F0F0F0] bg-white px-2 py-1 text-xs text-[#333] hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none"
                              />
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(file.name)}
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

              {dateSource !== "event" && (() => {
                const missingCount = files.filter(
                  (f) => !fileMetaDates[f.name],
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
          value={selectedEventId}
          onChange={(e) => handleEventSelect(e.target.value)}
          className="cursor-pointer pt-4.5 pb-4.5 w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
        >
          <option value="">Select an event (optional)</option>
          {sortedEvents.map((event) => {
            // Parse date as local time to avoid timezone offset issues
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
          value={eventName}
          onChange={(e) => handleEventNameChange(e.target.value)}
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
      {(!files || files.length <= 1) && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[#333]">
            Date{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
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
        onClick={handleUpload}
        disabled={
          isUploading ||
          !files ||
          files.length === 0 ||
          isReadingMeta ||
          // For a single file: require a date unless EXIF already provided one
          (files.length === 1 &&
            !date &&
            !fileMetaDates[files[0]?.name ?? ""])
        }
        className="cursor-pointer w-full rounded-xl bg-[#F7DEE2] py-4 font-semibold text-[#333] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F3CED6] hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 touch-manipulation"
      >
        {isUploading ? (
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
            Uploading…
          </span>
        ) : (
          "Upload Media"
        )}
      </button>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-red-800">Upload Failed</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-4 rounded-xl border-2 border-[#F0F0F0] bg-[#FAFAF7] p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#333]">
              Upload Progress
            </h2>
            <span className="rounded-full bg-[#D8ECFF]/70 px-2.5 py-0.5 text-xs font-semibold text-[#333]">
              {uploadProgress.filter((p) => p.status === "success").length} /{" "}
              {uploadProgress.length}
            </span>
          </div>

          <div className="space-y-3">
            {uploadProgress.map((item) => (
              <div
                key={item.fileName}
                className="space-y-2 rounded-lg bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 truncate text-sm font-medium text-[#333]">
                    {item.fileName}
                  </p>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                      item.status === "success"
                        ? "bg-green-100 text-green-800"
                        : item.status === "error"
                          ? "bg-red-100 text-red-800"
                          : item.status === "uploading"
                            ? "bg-blue-100 text-blue-800"
                            : item.status === "converting"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {item.status === "success" && "✓ Done"}
                    {item.status === "error" && "✗ Failed"}
                    {item.status === "uploading" && "⬆ Uploading"}
                    {item.status === "converting" && "⚙ Converting"}
                    {item.status === "pending" && "⏳ Pending"}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.status === "success"
                        ? "bg-green-500"
                        : item.status === "error"
                          ? "bg-red-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>

                {/* Progress Text and Error */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">
                    {item.progress}%
                  </p>
                  {item.error && (
                    <p className="text-xs font-medium text-red-600">
                      {item.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
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
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
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
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
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
              value={newEventEmoji}
              onChange={(e) => setNewEventEmoji(e.target.value)}
              focusColor="#F7DEE2"
              borderColor="#F0F0F0"
              labelColor="#333"
            />
          </div>
        </div>
        <button
          onClick={handleCreateEvent}
          disabled={isCreatingEvent || !newEventDate || !newEventTitle.trim()}
          className="cursor-pointer w-full rounded-xl mt-3 bg-[#F7DEE2] py-3 font-semibold text-[#333] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F3CED6] hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 touch-manipulation"
        >
          {isCreatingEvent ? (
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

