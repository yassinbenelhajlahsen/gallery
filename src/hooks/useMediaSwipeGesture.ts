import { useRef, useCallback } from "react";
import type { RefObject, TouchEvent } from "react";

interface SwipeGestureOptions {
  mediaLength: number;
  visualIndex: number;
  slideDuration: number;
  goToNext: () => void;
  goToPrev: () => void;
  slideContainerRef: RefObject<HTMLDivElement | null>;
}

export function useMediaSwipeGesture({
  mediaLength,
  visualIndex,
  slideDuration,
  goToNext,
  goToPrev,
  slideContainerRef,
}: SwipeGestureOptions) {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const dragOffsetRef = useRef<number>(0);

  const onTouchStart = useCallback((event: TouchEvent) => {
    if (mediaLength <= 1) {
      touchStartXRef.current = null;
      return;
    }
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartTimeRef.current = Date.now();
    dragOffsetRef.current = 0;
  }, [mediaLength]);

  const onTouchMove = useCallback((event: TouchEvent) => {
    if (touchStartXRef.current == null || mediaLength <= 1) return;
    const currentX = event.touches[0]?.clientX ?? 0;
    const delta = currentX - touchStartXRef.current;
    dragOffsetRef.current = delta;
    if (slideContainerRef.current) {
      const base = `calc(${visualIndex} * (-100% - 1.5rem))`;
      slideContainerRef.current.style.transitionDuration = "0ms";
      slideContainerRef.current.style.transform = `translateX(calc(${base} + ${delta}px))`;
    }
  }, [mediaLength, slideContainerRef, visualIndex]);

  const onTouchEnd = useCallback((event: TouchEvent) => {
    if (mediaLength <= 1) {
      touchStartXRef.current = null;
      return;
    }
    if (touchStartXRef.current == null) return;

    const endX = event.changedTouches[0]?.clientX ?? 0;
    const deltaX = endX - touchStartXRef.current;
    const elapsed = Math.max(Date.now() - touchStartTimeRef.current, 1);
    const velocity = Math.abs(deltaX) / elapsed;

    if (slideContainerRef.current) {
      slideContainerRef.current.style.transitionDuration = `${slideDuration}ms`;
    }

    const distanceThreshold = 50;
    const velocityThreshold = 0.3;
    const shouldNavigate =
      Math.abs(deltaX) > distanceThreshold || velocity > velocityThreshold;

    if (shouldNavigate && deltaX > 0) {
      goToPrev();
    } else if (shouldNavigate && deltaX < 0) {
      goToNext();
    } else if (slideContainerRef.current) {
      const base = `calc(${visualIndex} * (-100% - 1.5rem))`;
      slideContainerRef.current.style.transform = `translateX(${base})`;
    }

    touchStartXRef.current = null;
    dragOffsetRef.current = 0;
  }, [goToNext, goToPrev, mediaLength, slideContainerRef, slideDuration, visualIndex]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
