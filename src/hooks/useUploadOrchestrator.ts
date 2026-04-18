import { useState, useCallback } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import type { UseUploadStagingApi } from "./useUploadStaging";

export interface UploadProgress {
  fileName: string;
  status: "uploading" | "success" | "error";
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
  commitAll: UseUploadStagingApi["commitAll"];
}

export function useUploadOrchestrator({
  files,
  fileMetaDates,
  date,
  dateSource,
  eventName,
  clearForm,
  commitAll,
}: OrchestratorParams) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { refreshGallery } = useGallery();
  const { toast } = useToast();

  const handleUpload = useCallback(async () => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(
      files.map((f) => ({
        fileName: f.name,
        status: "uploading" as const,
        progress: 50,
      })),
    );

    const resolveDate = (fileName: string): string | null => {
      if (dateSource === "event") return date || null;
      return fileMetaDates[fileName] ?? date ?? null;
    };

    try {
      const results = await commitAll(resolveDate, eventName);
      setUploadProgress(
        results.map((r) => ({
          fileName: r.fileName,
          status: r.status,
          progress: r.status === "success" ? 100 : 0,
          url: r.url,
          error: r.error,
        })),
      );

      const successes = results.filter((r) => r.status === "success");
      if (successes.length === 0) {
        setError("No files were successfully uploaded");
        return;
      }

      toast(
        `${successes.length} upload${successes.length === 1 ? "" : "s"} completed successfully!`,
        "success",
      );
      await refreshGallery();
      clearForm();
      setUploadProgress([]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      console.error(`[Upload] Fatal error:`, err);
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [
    files,
    fileMetaDates,
    date,
    dateSource,
    eventName,
    commitAll,
    clearForm,
    refreshGallery,
    toast,
  ]);

  return { isUploading, uploadProgress, error, handleUpload };
}
