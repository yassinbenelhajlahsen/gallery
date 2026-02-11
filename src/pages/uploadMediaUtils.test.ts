import { describe, expect, it } from "vitest";
import { getVideoExtension, isVideoFile } from "./uploadMediaUtils";

describe("upload media utils", () => {
  it("detects mp4 and mov files as videos", () => {
    const mp4 = new File(["x"], "clip.MP4", { type: "video/mp4" });
    const mov = new File(["x"], "clip.mov", { type: "video/quicktime" });
    const jpg = new File(["x"], "photo.jpg", { type: "image/jpeg" });

    expect(isVideoFile(mp4)).toBe(true);
    expect(isVideoFile(mov)).toBe(true);
    expect(isVideoFile(jpg)).toBe(false);
  });

  it("returns normalized extension for supported videos", () => {
    const mp4 = new File(["x"], "clip.MP4");
    const mov = new File(["x"], "clip.MOV");
    const webm = new File(["x"], "clip.webm");

    expect(getVideoExtension(mp4)).toBe("mp4");
    expect(getVideoExtension(mov)).toBe("mov");
    expect(getVideoExtension(webm)).toBeNull();
  });
});
