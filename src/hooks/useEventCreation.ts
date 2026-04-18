import { useState, useCallback } from "react";
import { useGallery } from "../context/GalleryContext";
import { useToast } from "../context/ToastContext";
import { createTimelineEvent } from "../services/uploadService";

export function useEventCreation() {
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventEmoji, setNewEventEmoji] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const { refreshEvents } = useGallery();
  const { toast } = useToast();

  const handleCreateEvent = useCallback(async () => {
    if (!newEventDate || !newEventTitle.trim()) {
      toast("Please fill in date and title.", "error");
      return;
    }
    setIsCreatingEvent(true);
    try {
      await createTimelineEvent(newEventDate, newEventTitle, newEventEmoji);
      await refreshEvents();
      toast("Event created successfully!", "success");
      setNewEventDate("");
      setNewEventEmoji("");
      setNewEventTitle("");
    } catch (err) {
      console.error("Failed to create event:", err);
      toast("Failed to create event. Please try again.", "error");
    } finally {
      setIsCreatingEvent(false);
    }
  }, [newEventDate, newEventTitle, newEventEmoji, refreshEvents, toast]);

  return {
    newEventDate,
    setNewEventDate,
    newEventEmoji,
    setNewEventEmoji,
    newEventTitle,
    setNewEventTitle,
    isCreatingEvent,
    handleCreateEvent,
  };
}
