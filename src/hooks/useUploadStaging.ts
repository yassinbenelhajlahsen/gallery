import { useCallback, useEffect, useRef, useState } from "react";
import {
  commitImage,
  commitVideo,
  discardStagedImage,
  discardStagedVideo,
  stageImage,
  stageVideo,
  type StagedImage,
  type StagedVideo,
} from "../services/uploadService";
import { isVideoFile } from "../utils/uploadMediaUtils";

export type StagingStatus = "staging" | "staged" | "error";

export interface StagingEntry {
  fileName: string;
  status: StagingStatus;
  progress: number;
  error?: string;
  isVideo: boolean;
}

type StagedRef =
  | { kind: "image"; data: StagedImage }
  | { kind: "video"; data: StagedVideo };

interface InternalSlot {
  controller: AbortController;
  promise: Promise<StagedRef>;
  staged?: StagedRef;
  committed: boolean;
}

export interface CommitResult {
  fileName: string;
  status: "success" | "error";
  url?: string;
  error?: string;
}

export interface UseUploadStagingApi {
  entries: Record<string, StagingEntry>;
  retry: (fileName: string) => void;
  commitAll: (
    resolveDate: (fileName: string) => string | null,
    eventName: string,
  ) => Promise<CommitResult[]>;
  isStaging: boolean;
  hasStagedAny: boolean;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "storage/canceled"
  ) {
    return true;
  }
  return false;
}

export function useUploadStaging(files: File[] | null): UseUploadStagingApi {
  const [entries, setEntries] = useState<Record<string, StagingEntry>>({});
  const slotsRef = useRef<Map<string, InternalSlot>>(new Map());
  const filesRef = useRef<Map<string, File>>(new Map());

  const updateEntry = useCallback(
    (fileName: string, patch: Partial<StagingEntry>) => {
      setEntries((prev) => {
        const existing = prev[fileName];
        if (!existing) return prev;
        return { ...prev, [fileName]: { ...existing, ...patch } };
      });
    },
    [],
  );

  const removeEntry = useCallback((fileName: string) => {
    setEntries((prev) => {
      if (!(fileName in prev)) return prev;
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }, []);

  const startStaging = useCallback(
    (file: File) => {
      const controller = new AbortController();
      const isVideo = isVideoFile(file);

      setEntries((prev) => ({
        ...prev,
        [file.name]: {
          fileName: file.name,
          status: "staging",
          progress: 0,
          isVideo,
        },
      }));

      const onProgress = (fraction: number) => {
        updateEntry(file.name, {
          progress: Math.round(Math.min(1, Math.max(0, fraction)) * 100),
        });
      };

      const slot: InternalSlot = {
        controller,
        promise: undefined as unknown as Promise<StagedRef>,
        committed: false,
      };

      const stagingPromise: Promise<StagedRef> = (
        isVideo
          ? stageVideo(file, onProgress, controller.signal).then(
              (data): StagedRef => ({ kind: "video", data }),
            )
          : stageImage(file, onProgress, controller.signal).then(
              (data): StagedRef => ({ kind: "image", data }),
            )
      )
        .then((staged) => {
          slot.staged = staged;
          if (!slot.committed && slotsRef.current.get(file.name) === slot) {
            updateEntry(file.name, { status: "staged", progress: 100 });
          }
          return staged;
        })
        .catch((err) => {
          if (isAbortError(err)) {
            throw err;
          }
          const message = err instanceof Error ? err.message : String(err);
          if (slotsRef.current.get(file.name) === slot) {
            updateEntry(file.name, {
              status: "error",
              error: message,
              progress: 0,
            });
          }
          throw err;
        });

      slot.promise = stagingPromise;
      slotsRef.current.set(file.name, slot);
      filesRef.current.set(file.name, file);

      // Prevent unhandled-rejection warnings; consumers await via commitAll.
      stagingPromise.catch(() => {});
    },
    [updateEntry],
  );

  const dropSlot = useCallback(
    async (fileName: string) => {
      const slot = slotsRef.current.get(fileName);
      if (!slot) return;
      slotsRef.current.delete(fileName);
      filesRef.current.delete(fileName);
      removeEntry(fileName);
      if (slot.committed) return;
      slot.controller.abort();
      try {
        await slot.promise;
      } catch {
        // abort or stage error — both are fine here
      }
      if (slot.staged) {
        if (slot.staged.kind === "image") {
          await discardStagedImage(slot.staged.data);
        } else {
          await discardStagedVideo(slot.staged.data);
        }
      }
    },
    [removeEntry],
  );

  useEffect(() => {
    const currentNames = new Set((files ?? []).map((f) => f.name));
    for (const name of Array.from(slotsRef.current.keys())) {
      if (!currentNames.has(name)) {
        void dropSlot(name);
      }
    }
    for (const file of files ?? []) {
      if (!slotsRef.current.has(file.name)) {
        startStaging(file);
      }
    }
  }, [files, startStaging, dropSlot]);

  const retry = useCallback(
    (fileName: string) => {
      const file = filesRef.current.get(fileName);
      const slot = slotsRef.current.get(fileName);
      if (!file || !slot || slot.committed) return;
      slotsRef.current.delete(fileName);
      removeEntry(fileName);
      if (slot.staged) {
        const staged = slot.staged;
        void (staged.kind === "image"
          ? discardStagedImage(staged.data)
          : discardStagedVideo(staged.data));
      }
      startStaging(file);
    },
    [removeEntry, startStaging],
  );

  const commitAll = useCallback(
    async (
      resolveDate: (fileName: string) => string | null,
      eventName: string,
    ): Promise<CommitResult[]> => {
      const fileList = files ?? [];
      const results: CommitResult[] = [];

      await Promise.all(
        fileList.map(async (file) => {
          const slot = slotsRef.current.get(file.name);
          if (!slot) {
            results.push({
              fileName: file.name,
              status: "error",
              error: "Not staged",
            });
            return;
          }
          const date = resolveDate(file.name);
          if (!date) {
            results.push({
              fileName: file.name,
              status: "error",
              error: "No date — set a Fallback Date above",
            });
            return;
          }
          try {
            const staged = await slot.promise;
            const { url } =
              staged.kind === "image"
                ? await commitImage(staged.data, date, eventName)
                : await commitVideo(staged.data, date, eventName);
            slot.committed = true;
            results.push({ fileName: file.name, status: "success", url });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            results.push({
              fileName: file.name,
              status: "error",
              error: message,
            });
          }
        }),
      );

      return results;
    },
    [files],
  );

  const isStaging = Object.values(entries).some((e) => e.status === "staging");
  const hasStagedAny = Object.values(entries).some((e) => e.status === "staged");

  return { entries, retry, commitAll, isStaging, hasStagedAny };
}
