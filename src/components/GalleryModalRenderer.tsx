import React from "react";
import ImageModalViewer from "./ImageModalViewer";
import { useGallery } from "../context/GalleryContext";

const GalleryModalRenderer: React.FC = () => {
  const {
    modalImages,
    modalInitialIndex,
    modalPreloadAll,
    isModalOpen,
    closeModal,
    resolveThumbUrl,
    updateModalIndex,
  } = useGallery();

  return (
    <ImageModalViewer
      images={modalImages}
      initialIndex={modalInitialIndex}
      isOpen={isModalOpen}
      onClose={closeModal}
      onChangeIndex={updateModalIndex}
      resolveThumbUrl={resolveThumbUrl}
      preloadAll={modalPreloadAll}
    />
  );
};

export default GalleryModalRenderer;
