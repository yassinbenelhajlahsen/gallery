import { describe, expect, it } from "vitest";
import { getVideoExtension, isVideoFile } from "../../utils/uploadMediaUtils";

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

  it("supports filenames with multiple dots", () => {
    const mp4 = new File(["x"], "anniversary.cut.v2.MP4");
    const mov = new File(["x"], "movie.final.export.Mov");

    expect(isVideoFile(mp4)).toBe(true);
    expect(isVideoFile(mov)).toBe(true);
    expect(getVideoExtension(mp4)).toBe("mp4");
    expect(getVideoExtension(mov)).toBe("mov");
  });

  it("does not classify by MIME type when extension is unsupported", () => {
    const webmNamedAsVideo = new File(["x"], "clip.webm", {
      type: "video/webm",
    });
    const noExtensionVideoType = new File(["x"], "clip", { type: "video/mp4" });

    expect(isVideoFile(webmNamedAsVideo)).toBe(false);
    expect(isVideoFile(noExtensionVideoType)).toBe(false);
    expect(getVideoExtension(webmNamedAsVideo)).toBeNull();
    expect(getVideoExtension(noExtensionVideoType)).toBeNull();
  });
});
