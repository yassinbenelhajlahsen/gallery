// src/components/gallery/GalleryModalRenderer.tsx
import React from "react";
import ImageModalViewer from "./mediaModalViewer";
import { useGallery } from "../../context/GalleryContext";

const GalleryModalRenderer: React.FC = () => {
  const {
    modalMedia,
    modalInitialIndex,
    modalPreloadAll,
    isModalOpen,
    closeModal,
    resolveThumbUrl,
    resolveVideoThumbUrl,
    updateModalIndex,
  } = useGallery();

  return (
    <ImageModalViewer
      media={modalMedia}
      initialIndex={modalInitialIndex}
      isOpen={isModalOpen}
      onClose={closeModal}
      onChangeIndex={updateModalIndex}
      resolveThumbUrl={resolveThumbUrl}
      resolveVideoThumbUrl={resolveVideoThumbUrl}
      preloadAll={modalPreloadAll}
    />
  );
};

export default GalleryModalRenderer;
