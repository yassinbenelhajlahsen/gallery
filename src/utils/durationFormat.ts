export function formatDurationSeconds(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(durationSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
