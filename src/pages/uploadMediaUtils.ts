export const isVideoFile = (file: File) => {
  const name = file.name.toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".mov");
};

export const getVideoExtension = (file: File) => {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp4")) return "mp4";
  if (lower.endsWith(".mov")) return "mov";
  return null;
};
