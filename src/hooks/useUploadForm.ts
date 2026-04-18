import { useState, useMemo, useRef, useCallback } from "react";
import type { RefObject, ChangeEvent } from "react";
import { useGallery } from "../context/GalleryContext";
import { sortEventsByDateDesc } from "../services/eventsService";
import { inferUploadDateFromMetadata } from "../utils/uploadDateMetadata";

type DateSource = "none" | "event" | "metadata" | "manual";

export function useUploadForm(fileInputRef: RefObject<HTMLInputElement | null>) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [fileMetaDates, setFileMetaDates] = useState<Record<string, string | null>>({});
  const [isReadingMeta, setIsReadingMeta] = useState(false);
  const [date, setDate] = useState("");
  const [dateSource, setDateSource] = useState<DateSource>("none");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const { events } = useGallery();
  const probeIdRef = useRef(0);

  const sortedEvents = useMemo(() => sortEventsByDateDesc(events), [events]);

  const probeFilesMetadata = useCallback(async (filesToProbe: File[]) => {
    const probeId = probeIdRef.current + 1;
    probeIdRef.current = probeId;
    setIsReadingMeta(true);
    const dates = await Promise.all(filesToProbe.map((f) => inferUploadDateFromMetadata(f)));
    if (probeIdRef.current !== probeId) return;
    const metaMap: Record<string, string | null> = {};
    filesToProbe.forEach((f, i) => { metaMap[f.name] = dates[i] ?? null; });
    setFileMetaDates(metaMap);
    setIsReadingMeta(false);
    if (filesToProbe.length === 1 && dates[0] && (dateSource === "none" || dateSource === "metadata")) {
      setDate(dates[0]);
      setDateSource("metadata");
    }
  }, [dateSource]);

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files;
      setFiles(selectedFiles ? Array.from(selectedFiles) : null);
      setFileMetaDates({});
      if (!selectedFiles || selectedFiles.length === 0) return;
      if (dateSource === "event") return;
      if (dateSource === "metadata") {
        setDate("");
        setDateSource("none");
      }
      await probeFilesMetadata(Array.from(selectedFiles));
    },
    [dateSource, probeFilesMetadata],
  );

  const handleRemoveFile = useCallback((fileName: string) => {
    setFiles((prev) => {
      const next = prev ? prev.filter((f) => f.name !== fileName) : null;
      return next && next.length > 0 ? next : null;
    });
    setFileMetaDates((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [fileInputRef]);

  const handleEventSelect = useCallback(
    (eventId: string) => {
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
    },
    [files, probeFilesMetadata, sortedEvents],
  );

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
    setDateSource(newDate ? "manual" : "none");
    setSelectedEventId("");
  }, []);

  const handleEventNameChange = useCallback((newName: string) => {
    setEventName(newName);
    setSelectedEventId("");
  }, []);

  const clearForm = useCallback(() => {
    setFiles(null);
    setFileMetaDates({});
    setDate("");
    setDateSource("none");
    setSelectedEventId("");
    setEventName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [fileInputRef]);

  return {
    files,
    fileMetaDates,
    setFileMetaDates,
    isReadingMeta,
    date,
    dateSource,
    selectedEventId,
    eventName,
    sortedEvents,
    handleFileInputChange,
    handleRemoveFile,
    handleEventSelect,
    handleDateChange,
    handleEventNameChange,
    clearForm,
  };
}
