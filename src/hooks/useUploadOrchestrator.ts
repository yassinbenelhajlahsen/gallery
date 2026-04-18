import { useState, useCallback, useEffect } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import type { StagingEntry, UseUploadStagingApi } from "./useUploadStaging";

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
  entries: Record<string, StagingEntry>;
}

export function useUploadOrchestrator({
  files,
  fileMetaDates,
  date,
  dateSource,
  eventName,
  clearForm,
  commitAll,
  entries,
}: OrchestratorParams) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [hasCommitResults, setHasCommitResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshGallery } = useGallery();
  const { toast } = useToast();

  // While uploading and before commit resolves, keep the visible progress in
  // sync with real byte transfer from the staging hook.
  useEffect(() => {
    if (!isUploading || hasCommitResults || !files) return;
    setUploadProgress(
      files.map((f) => {
        const entry = entries[f.name];
        return {
          fileName: f.name,
          status: "uploading" as const,
          progress: entry?.progress ?? 0,
        };
      }),
    );
  }, [isUploading, hasCommitResults, files, entries]);

  const handleUpload = useCallback(async () => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);
    setHasCommitResults(false);
    setUploadProgress(
      files.map((f) => {
        const entry = entries[f.name];
        return {
          fileName: f.name,
          status: "uploading" as const,
          progress: entry?.progress ?? 0,
        };
      }),
    );

    const resolveDate = (fileName: string): string | null => {
      if (dateSource === "event") return date || null;
      return fileMetaDates[fileName] ?? date ?? null;
    };

    try {
      const results = await commitAll(resolveDate, eventName);
      setHasCommitResults(true);
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
      setHasCommitResults(false);
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
    entries,
    commitAll,
    clearForm,
    refreshGallery,
    toast,
  ]);

  return { isUploading, uploadProgress, error, handleUpload };
}
