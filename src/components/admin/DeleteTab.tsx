import { useMediaSearch } from "../../hooks/useMediaSearch";
import { useMetadataEditor } from "../../hooks/useMetadataEditor";
import { useDeleteConfirmation } from "../../hooks/useDeleteConfirmation";
import { normalizeImageSrc, toDateLabel } from "../../services/deleteService";
import { useGallery } from "../../context/GalleryContext";
import EditMetadataModal from "../ui/EditMetadataModal";
import DeleteConfirmModal from "../ui/DeleteConfirmModal";

export default function DeleteTab() {
  const { resolveThumbUrl, resolveVideoThumbUrl } = useGallery();
  const search = useMediaSearch();
  const metaEditor = useMetadataEditor();
  const deleteOps = useDeleteConfirmation(metaEditor.isSavingEdit);

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-[#333]">
          Edit & Delete Media & Events
        </h2>
        <p className="text-sm text-[#666]">
          Use Edit to update, or Delete to remove items.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/85 p-4">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="delete-search"
            className="text-sm font-semibold text-[#333]"
          >
            Search media and events
          </label>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {search.hasActiveSearch ? search.totalMatches : search.totalItems}
          </span>
        </div>
        <div className="relative">
          <input
            id="delete-search"
            type="search"
            value={search.searchQuery}
            onChange={(event) => search.setSearchQuery(event.target.value)}
            placeholder="Search by date, event or file name"
            className="w-full rounded-xl border border-[#ecd6d6] bg-white px-4 py-2.5 text-sm text-[#333] shadow-sm transition-all duration-200 focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/35"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Images</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {search.filteredImageMetas.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {search.filteredImageMetas.length === 0 ? (
            <p className="text-sm text-[#888]">
              {search.hasActiveSearch ? "No images match your search." : "No images found."}
            </p>
          ) : (
            search.filteredImageMetas.map((meta, index) => {
              const key = `image:${meta.id}`;
              const thumbSrc = normalizeImageSrc(resolveThumbUrl(meta));
              const isOddTail =
                search.filteredImageMetas.length % 2 === 1 &&
                index === search.filteredImageMetas.length - 1;
              return (
                <div
                  key={meta.id}
                  className={`rounded-xl border border-[#f0f0f0] bg-white p-3 sm:flex sm:items-center sm:gap-3 ${isOddTail ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={meta.event ?? meta.id}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover sm:h-12 sm:w-12"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-10 w-10 shrink-0 rounded-lg bg-[#f5f5f5] sm:h-12 sm:w-12"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#333]">{meta.id}</p>
                      <p className="text-xs text-[#777]">{toDateLabel(meta.date)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:items-center sm:gap-2">
                    <button
                      type="button"
                      disabled={Boolean(deleteOps.busyKey) || metaEditor.isSavingEdit}
                      onClick={() => metaEditor.openImageEditor(meta.id, meta.date, meta.event)}
                      className="w-full cursor-pointer rounded-full bg-[#ececec] px-3 py-1.5 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(deleteOps.busyKey) || metaEditor.isSavingEdit}
                      onClick={() =>
                        deleteOps.requestDeleteImage(
                          meta.id,
                          meta.storagePath,
                          `images/thumb/${meta.id}`,
                        )
                      }
                      className="w-full cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {deleteOps.buttonLabel(key)}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Videos</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {search.filteredVideoMetas.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {search.filteredVideoMetas.length === 0 ? (
            <p className="text-sm text-[#888]">
              {search.hasActiveSearch ? "No videos match your search." : "No videos found."}
            </p>
          ) : (
            search.filteredVideoMetas.map((meta, index) => {
              const key = `video:${meta.id}`;
              const thumbSrc = normalizeImageSrc(
                resolveVideoThumbUrl(meta) || meta.thumbUrl,
              );
              const isOddTail =
                search.filteredVideoMetas.length % 2 === 1 &&
                index === search.filteredVideoMetas.length - 1;
              return (
                <div
                  key={meta.id}
                  className={`rounded-xl border border-[#f0f0f0] bg-white p-3 sm:flex sm:items-center sm:gap-3 ${isOddTail ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={meta.event ?? meta.id}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover sm:h-12 sm:w-12"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-10 w-10 shrink-0 rounded-lg bg-[#f5f5f5] sm:h-12 sm:w-12"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#333]">{meta.id}</p>
                      <p className="text-xs text-[#777]">{toDateLabel(meta.date)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:items-center sm:gap-2">
                    <button
                      type="button"
                      disabled={Boolean(deleteOps.busyKey) || metaEditor.isSavingEdit}
                      onClick={() => metaEditor.openVideoEditor(meta.id, meta.date, meta.event)}
                      className="w-full cursor-pointer rounded-full bg-[#ececec] px-3 py-1.5 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(deleteOps.busyKey) || metaEditor.isSavingEdit}
                      onClick={() =>
                        deleteOps.requestDeleteVideo(
                          meta.id,
                          meta.videoPath,
                          `videos/thumb/${meta.id.replace(/\.[^.]+$/, ".jpg")}`,
                        )
                      }
                      className="w-full cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {deleteOps.buttonLabel(key)}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#f1dada] bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#333]">Timeline Events</h3>
          <span className="rounded-full bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#7d1f1f]">
            {search.filteredEvents.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {search.filteredEvents.length === 0 ? (
            <p className="text-sm text-[#888]">
              {search.hasActiveSearch
                ? "No timeline events match your search."
                : "No timeline events found."}
            </p>
          ) : (
            search.filteredEvents.map((event, index) => {
              const key = `event:${event.id}`;
              const isOddTail =
                search.filteredEvents.length % 2 === 1 &&
                index === search.filteredEvents.length - 1;
              return (
                <div
                  key={event.id}
                  className={`rounded-xl border border-[#f0f0f0] bg-white p-3 sm:flex sm:items-center sm:gap-3 ${isOddTail ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f8f8f8] text-xl sm:h-12 sm:w-12">
                      {event.emojiOrDot ?? "•"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#333]">{event.title}</p>
                      <p className="text-xs text-[#777]">{toDateLabel(event.date)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:items-center sm:gap-2">
                    <button
                      type="button"
                      disabled={Boolean(deleteOps.busyKey) || metaEditor.isSavingEdit}
                      onClick={() =>
                        metaEditor.openEventEditor(
                          event.id,
                          event.date,
                          event.title,
                          event.emojiOrDot,
                          event.imageIds,
                        )
                      }
                      className="w-full cursor-pointer rounded-full bg-[#ececec] px-3 py-1.5 text-xs font-semibold text-[#4f4f4f] transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(deleteOps.busyKey) || metaEditor.isSavingEdit}
                      onClick={() =>
                        deleteOps.requestDeleteEvent(event.id, event.title, event.imageIds ?? [])
                      }
                      className="w-full cursor-pointer rounded-full bg-[#ffebeb] px-3 py-1.5 text-xs font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {deleteOps.buttonLabel(key)}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <DeleteConfirmModal
        draft={deleteOps.deleteDraft}
        isDeleting={deleteOps.isDeletingCurrentDraft}
        onClose={deleteOps.closeDeleteConfirm}
        onConfirm={() => { void deleteOps.confirmDelete(); }}
      />

      <EditMetadataModal
        draft={metaEditor.editDraft}
        isSaving={metaEditor.isSavingEdit}
        onClose={metaEditor.closeEditor}
        onChange={(nextDraft) => metaEditor.setEditDraft(nextDraft)}
        onSave={() => { void metaEditor.saveEdit(); }}
      />
    </div>
  );
}
