import { useState, useCallback } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import { uploadImageWithMetadata, uploadVideoWithMetadata } from "../services/uploadService";
import { isVideoFile } from "../utils/uploadMediaUtils";

export interface UploadProgress {
  fileName: string;
  status: "pending" | "converting" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  url?: string;
}

interface OrchestratorParams {
  files: File[] | null;
  fileMetaDates: Record<string, string | null>;
  date: string;
  dateSource: "none" | "event" | "metadata" | "manual";
  eventName: string;
  clearForm: () => void;
}

export function useUploadOrchestrator({
  files,
  fileMetaDates,
  date,
  dateSource,
  eventName,
  clearForm,
}: OrchestratorParams) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { refreshGallery } = useGallery();
  const { toast } = useToast();

  const updateProgress = useCallback((fileName: string, updates: Partial<UploadProgress>) => {
    setUploadProgress((prev) => {
      const existing = prev.find((p) => p.fileName === fileName);
      if (existing) {
        return prev.map((p) => (p.fileName === fileName ? { ...p, ...updates } : p));
      }
      return [...prev, { fileName, status: "pending", progress: 0, ...updates }];
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);
    const filesArr = files;
    setUploadProgress(filesArr.map((f) => ({ fileName: f.name, status: "pending" as const, progress: 0 })));
    const results: string[] = [];

    const CONCURRENCY = 3;

    const processOne = async (originalFile: File) => {
      const fileName = originalFile.name;
      const effectiveDate = dateSource === "event" ? date : (fileMetaDates[originalFile.name] ?? date);

      if (!effectiveDate) {
        updateProgress(fileName, { status: "error", error: "No date — set a Fallback Date above", progress: 0 });
        return;
      }

      updateProgress(fileName, { status: "converting", progress: 2 });

      try {
        let seenFirstByte = false;
        const onBytes = (fraction: number) => {
          if (!seenFirstByte && fraction > 0) {
            seenFirstByte = true;
            updateProgress(fileName, { status: "uploading" });
          }
          updateProgress(fileName, { progress: Math.round(5 + fraction * 93) });
        };
        const { url } = isVideoFile(originalFile)
          ? await uploadVideoWithMetadata(originalFile, effectiveDate, eventName, onBytes)
          : await uploadImageWithMetadata(originalFile, effectiveDate, eventName, onBytes);
        updateProgress(fileName, { progress: 100, status: "success", url });
        results.push(url);
      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`[Upload] Failed to upload ${fileName}:`, fileError);
        updateProgress(fileName, { status: "error", error: errorMessage, progress: 0 });
      }
    };

    try {
      const queue = [...filesArr];
      const workerCount = Math.min(CONCURRENCY, queue.length);
      const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file) break;
          await processOne(file);
        }
      });
      await Promise.all(workers);

      if (results.length === 0) {
        setError("No files were successfully uploaded");
        return;
      }

      toast(`${results.length} upload${results.length === 1 ? "" : "s"} completed successfully!`, "success");
      await refreshGallery();
      clearForm();
      setUploadProgress([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      console.error(`[Upload] Fatal error:`, err);
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [files, fileMetaDates, date, dateSource, eventName, clearForm, refreshGallery, toast, updateProgress]);

  return { isUploading, uploadProgress, error, handleUpload };
}
