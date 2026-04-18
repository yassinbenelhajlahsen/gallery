import { useMemo, useState } from "react";
import { useGallery } from "../context/GalleryContext";
import {
  buildSearchIndex,
  matchesTokens,
  normalizeText,
  toDateSearchTokens,
} from "../services/deleteService";
import { sortEventsByDateDesc } from "../services/eventsService";

export function useMediaSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const { imageMetas, videoMetas, events } = useGallery();

  const sortedEvents = useMemo(() => sortEventsByDateDesc(events), [events]);

  const searchTokens = useMemo(() => {
    const normalized = normalizeText(searchQuery);
    if (!normalized) return [];
    return normalized.split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  const hasActiveSearch = searchTokens.length > 0;

  const filteredImageMetas = useMemo(() => {
    if (!hasActiveSearch) return imageMetas;
    return imageMetas.filter((meta) => {
      const index = buildSearchIndex(meta.id, meta.event, ...toDateSearchTokens(meta.date));
      return matchesTokens(index, searchTokens);
    });
  }, [hasActiveSearch, imageMetas, searchTokens]);

  const filteredVideoMetas = useMemo(() => {
    if (!hasActiveSearch) return videoMetas;
    return videoMetas.filter((meta) => {
      const index = buildSearchIndex(meta.id, meta.event, ...toDateSearchTokens(meta.date));
      return matchesTokens(index, searchTokens);
    });
  }, [hasActiveSearch, searchTokens, videoMetas]);

  const filteredEvents = useMemo(() => {
    if (!hasActiveSearch) return sortedEvents;
    return sortedEvents.filter((event) => {
      const index = buildSearchIndex(
        event.title,
        ...toDateSearchTokens(event.date),
        ...(event.imageIds ?? []),
      );
      return matchesTokens(index, searchTokens);
    });
  }, [hasActiveSearch, searchTokens, sortedEvents]);

  const totalMatches =
    filteredImageMetas.length + filteredVideoMetas.length + filteredEvents.length;
  const totalItems = imageMetas.length + videoMetas.length + sortedEvents.length;

  return {
    searchQuery,
    setSearchQuery,
    hasActiveSearch,
    filteredImageMetas,
    filteredVideoMetas,
    filteredEvents,
    totalMatches,
    totalItems,
  };
}
