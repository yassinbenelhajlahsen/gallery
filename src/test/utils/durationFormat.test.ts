import { describe, expect, it } from "vitest";
import { formatDurationSeconds } from "../../utils/durationFormat";

describe("formatDurationSeconds", () => {
  it("formats standard values as MM:SS", () => {
    expect(formatDurationSeconds(0)).toBe("00:00");
    expect(formatDurationSeconds(9)).toBe("00:09");
    expect(formatDurationSeconds(65)).toBe("01:05");
  });

  it("handles long durations with multi-digit minutes", () => {
    expect(formatDurationSeconds(3605)).toBe("60:05");
  });

  it("floors fractional values and guards invalid inputs", () => {
    expect(formatDurationSeconds(125.9)).toBe("02:05");
    expect(formatDurationSeconds(-1)).toBe("00:00");
    expect(formatDurationSeconds(Number.NaN)).toBe("00:00");
  });
});
