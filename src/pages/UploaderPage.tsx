import { useState, useMemo, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../services/firebaseConfig";
import { useGallery } from "../context/GalleryContext";
import { usePageReveal } from "../hooks/usePageReveal";
import { useToast } from "../context/ToastContext";
import { config } from "../config";
import { setDoc, doc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

interface UploadProgress {
  fileName: string;
  status: "pending" | "converting" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  url?: string;
}

const isVideoFile = (file: File) => {
  const name = file.name.toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".mov");
};

const getVideoExtension = (file: File) => {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp4")) return "mp4";
  if (lower.endsWith(".mov")) return "mov";
  return null;
};

/**
 * Extracts a poster frame JPEG (quality 0.7, maxEdge 480) from a video file.
 * No transcoding/compression of the video itself.
 */
async function extractVideoPoster(file: File, maxEdge = 480): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
      URL.revokeObjectURL(objectUrl);
    };

    video.onloadedmetadata = async () => {
      try {
        // Seek to 0.1s to avoid black first frame in some videos
        const target = Math.min(0.1, Math.max(0, video.duration || 0));
        const seekTo = Number.isFinite(target) ? target : 0;
        video.currentTime = seekTo;
      } catch {
        // fallback: attempt capture without seek
        video.currentTime = 0;
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error("Unable to read video dimensions");

        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const outW = Math.round(w * scale);
        const outH = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context is null");
        ctx.drawImage(video, 0, 0, outW, outH);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error("Poster JPEG conversion failed"));
              return;
            }
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          0.7,
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video: ${file.name}`));
    };

    video.src = objectUrl;
  });
}

/**
 * Loads a File into an HTMLImageElement, returning the element.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          `Failed to load image: ${file.name} (Type: ${file.type}, Size: ${file.size} bytes)`,
        ),
      );
    };
    img.onabort = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Image load aborted: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

/**
 * Draws an HTMLImageElement onto a canvas at the given dimensions and returns
 * a JPEG Blob.
 */
function canvasToJpeg(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas context is null"));

    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("JPEG conversion failed"));
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Converts any image File into a full-res JPEG Blob (quality 0.9).
 */
async function convertToJpeg(img: HTMLImageElement): Promise<Blob> {
  return canvasToJpeg(img, img.width, img.height, 0.9);
}

/**
 * Generates a thumbnail JPEG from a loaded image element.
 * Resizes so the longest edge is at most `maxEdge` px (default 480),
 * encoded at quality 0.7.
 */
async function generateThumbnail(
  img: HTMLImageElement,
  maxEdge = 480,
): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const thumbW = Math.round(img.width * scale);
  const thumbH = Math.round(img.height * scale);
  return canvasToJpeg(img, thumbW, thumbH, 0.7);
}

export default function UploaderPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [date, setDate] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [eventName, setEventName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isVisible = usePageReveal();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State for creating new event
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventEmoji, setNewEventEmoji] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  const { events, refreshEvents, refreshGallery } = useGallery();

  // Sort events by date (newest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [events]);

  // Generate next event id by finding the max number and incrementing
  const generateNextEventId = () => {
    const maxNum = events.reduce((max, event) => {
      const num = parseInt(event.id.split("-")[1] || "0", 10);
      return Math.max(max, num);
    }, 0);
    return `evt-${String(maxNum + 1).padStart(3, "0")}`;
  };

  // Handle creating a new event
  const handleCreateEvent = async () => {
    if (!newEventDate || !newEventTitle.trim()) {
      toast("Please fill in date and title.", "error");
      return;
    }

    setIsCreatingEvent(true);
    try {
      const newId = generateNextEventId();
      const eventData = {
        id: newId,
        date: newEventDate,
        title: newEventTitle.trim(),
        emojiOrDot: newEventEmoji.trim() || undefined,
        imageIds: [],
      };

      await setDoc(doc(db, "events", newId), eventData);

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

  // Auto-fill date and event name when an event is selected
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = sortedEvents.find((e) => e.id === eventId);
    if (event) {
      setDate(event.date);
      setEventName(event.title);
    }
  };

  // Clear event selection when manually changing date or event name
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSelectedEventId("");
  };

  const handleEventNameChange = (newName: string) => {
    setEventName(newName);
    setSelectedEventId("");
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
    if (!date) {
      alert("Please choose a date.");
      return;
    }

    setError(null);
    setIsUploading(true);
    const results: string[] = [];

    // Initialize upload progress entries so the UI shows 0/TOTAL at start
    const filesArr = Array.from(files);
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
        updateProgress(fileName, { status: "converting", progress: 10 });

        try {
          const cleanName = originalFile.name.replace(/\.[^.]+$/, "");

          if (isVideoFile(originalFile)) {
            const ext = getVideoExtension(originalFile);
            if (!ext) {
              throw new Error("Unsupported video format (only .mp4 and .mov)");
            }

            updateProgress(fileName, { progress: 20 });
            const posterBlob = await extractVideoPoster(originalFile);
            updateProgress(fileName, { progress: 40 });

            const videoId = `${cleanName}.${ext}`;
            const thumbName = `${cleanName}.jpg`;

            const fullRef = ref(storage, `videos/full/${videoId}`);
            const thumbRef = ref(storage, `videos/thumb/${thumbName}`);

            const metadata = {
              customMetadata: {
                date,
                event: eventName || "",
              },
            };

            updateProgress(fileName, { status: "uploading", progress: 60 });

            // Metadata on video file ONLY
            await Promise.all([
              uploadBytes(fullRef, originalFile, metadata),
              uploadBytes(thumbRef, posterBlob),
            ]);

            updateProgress(fileName, { progress: 90 });
            const url = await getDownloadURL(thumbRef);
            updateProgress(fileName, { progress: 100 });
            updateProgress(fileName, { status: "success", url });
            results.push(url);
          } else {
            // Load the image once for both operations
            updateProgress(fileName, { progress: 20 });
            const img = await loadImage(originalFile);
            updateProgress(fileName, { progress: 30 });

            // Convert to full-res JPEG + generate thumbnail in parallel
            const [jpegBlob, thumbBlob] = await Promise.all([
              convertToJpeg(img),
              generateThumbnail(img),
            ]);
            updateProgress(fileName, { progress: 50 });

            const jpgName = `${cleanName}.jpg`;

            const fullRef = ref(storage, `images/full/${jpgName}`);
            const thumbRef = ref(storage, `images/thumb/${jpgName}`);

            const metadata = {
              customMetadata: {
                date,
                event: eventName || "",
              },
            };

            updateProgress(fileName, { status: "uploading", progress: 60 });

            // Upload full-res and thumbnail in parallel
            await Promise.all([
              uploadBytes(fullRef, jpegBlob, metadata),
              uploadBytes(thumbRef, thumbBlob, metadata),
            ]);
            updateProgress(fileName, { progress: 80 });

            const url = await getDownloadURL(fullRef);
            updateProgress(fileName, { progress: 100 });

            updateProgress(fileName, { status: "success", url });
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
        throw new Error("No files were successfully uploaded");
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
      setSelectedEventId("");
      setEventName("");
      setUploadProgress([]);
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
    <section className="flex w-full justify-center px-4 py-8">
      <div className="mx-auto w-full sm:max-w-full max-w-2xl space-y-6 rounded-4xl bg-white/90 p-8 shadow-[0_35px_120px_rgba(248,180,196,0.25)] ring-1 ring-white/60 backdrop-blur-2xl">
        <div
          className={`space-y-6 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <header className="space-y-2 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#C0C0C0]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.4em] text-[#3f3f3f]">
              Upload
            </span>
            <h1 className="text-3xl font-bold text-[#333]">
              Add New Photos/Videos
            </h1>
            <p className="text-sm text-[#666]">
              Upload images or videos and link them to a timeline event
            </p>
          </header>

          {/* Create New Event */}
          <div className="space-y-4 rounded-xl border-2 border-[#F0F0F0] bg-[#FAFAF7] p-5">
            <h2 className="text-lg font-semibold text-[#333]">
              Create New Event
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#333]">
                  Date *
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#333]">
                  Emoji
                </label>
                <input
                  type="text"
                  placeholder="🎂"
                  value={newEventEmoji}
                  onChange={(e) => setNewEventEmoji(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] placeholder-[#aaa] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#333]">
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="Birthday"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] placeholder-[#aaa] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
                />
              </div>
            </div>
            <button
              onClick={handleCreateEvent}
              disabled={
                isCreatingEvent || !newEventDate || !newEventTitle.trim()
              }
              className="w-full rounded-xl bg-[#F7DEE2] py-3 font-semibold text-[#333] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F3CED6] hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 touch-manipulation"
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

          <div className="h-px bg-linear-to-r from-transparent via-[#F0F0F0] to-transparent" />

          {/* Event Selection Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#333]">
              Link to Timeline Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => handleEventSelect(e.target.value)}
              className="w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
            >
              <option value="">Select an event (optional)</option>
              {sortedEvents.map((event) => {
                // Parse date as local time to avoid timezone offset issues
                const [year, month, day] = event.date.split("-").map(Number);
                const eventDate = new Date(
                  year ?? 0,
                  (month ?? 1) - 1,
                  day ?? 1,
                );
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
              Select an event to automatically fill date and event name, or
              enter custom details below
            </p>
          </div>

          <div className="h-px bg-linear-to-r from-transparent via-[#F0F0F0] to-transparent" />

          {/* File Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#333]">
              Select Media (Images / Videos) *
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/quicktime,.mp4,.mov"
                onChange={(e) => setFiles(e.target.files)}
                className="w-full rounded-xl border-2 border-dashed border-[#F0F0F0] bg-[#FAFAF7] px-4 py-6 text-sm text-[#666] transition-all duration-200 hover:border-[#F7DEE2] hover:bg-white focus:border-[#F7DEE2] focus:outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#F7DEE2] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#333] file:transition-all file:duration-200 hover:file:bg-[#F3CED6]"
              />
              {files && files.length > 0 && (
                <p className="mt-2 text-xs text-[#888]">
                  {files.length} file{files.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>
          </div>

          {/* Date Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#333]">
              Event Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
            />
          </div>

          {/* Event Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#333]">
              Event Name
            </label>
            <input
              type="text"
              placeholder={config.eventPlaceholder}
              value={eventName}
              onChange={(e) => handleEventNameChange(e.target.value)}
              className="w-full rounded-xl border-2 border-[#F0F0F0] bg-white px-4 py-3 text-[#333] placeholder-[#aaa] shadow-sm transition-all duration-200 hover:border-[#F7DEE2] focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/30"
            />
            <p className="text-xs text-[#888]">
              Used to link media to timeline events
            </p>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={isUploading || !files || files.length === 0 || !date}
            className="w-full rounded-xl bg-[#F7DEE2] py-4 font-semibold text-[#333] shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#F3CED6] hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 touch-manipulation"
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
                Converting & Uploading…
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
                  {uploadProgress.filter((p) => p.status === "success").length}{" "}
                  / {uploadProgress.length}
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
        </div>
      </div>
    </section>
  );
}
