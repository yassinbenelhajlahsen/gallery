import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePageReveal } from "../../hooks/usePageReveal";

describe("usePageReveal", () => {
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancel;
  });

  it("flips to visible after delay", () => {
    const { result } = renderHook(() => usePageReveal(50));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe(true);
  });

  it("cleans up timer on unmount", () => {
    const { unmount } = renderHook(() => usePageReveal(100));

    unmount();
    vi.advanceTimersByTime(100);

    expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
