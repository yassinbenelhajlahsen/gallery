import { useState, useEffect, useRef, useCallback } from "react";

const SLIDE_DURATION = 300;

function clampIndex(index: number, length: number) {
  if (length === 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

interface CarouselNavOptions {
  mediaLength: number;
  initialIndex: number;
  isOpen: boolean;
  onChangeIndex?: (nextIndex: number) => void;
  onClose: () => void;
}

export function useCarouselNavigation({
  mediaLength,
  initialIndex,
  isOpen,
  onChangeIndex,
  onClose,
}: CarouselNavOptions) {
  const [visualIndex, setVisualIndex] = useState(initialIndex);
  const [dataIndex, setDataIndex] = useState(initialIndex);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [suppressTransition, setSuppressTransition] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

  const clearAnimationTimeout = useCallback(() => {
    if (animationTimeoutRef.current != null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { clearAnimationTimeout(); };
  }, [clearAnimationTimeout]);

  // Reset nav state after close animation completes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setVisualIndex(0);
        setDataIndex(0);
        setIsAnimating(false);
        setIsClosing(false);
        clearAnimationTimeout();
      }, SLIDE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen, clearAnimationTimeout]);

  // Initialize indices when opening
  useEffect(() => {
    if (isOpen) {
      const safeIndex = clampIndex(initialIndex, mediaLength);
      // Intentional: syncs carousel position before first paint; React batches all three.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisualIndex(safeIndex);
      setDataIndex(safeIndex);
      setIsClosing(false);
    }
  }, [initialIndex, isOpen, mediaLength]);

  const goToIndex = useCallback(
    (next: number, _direction?: "left" | "right", immediate = false) => {
      if (!mediaLength) return;
      if (mediaLength <= 1 && !immediate) return;

      const wrapForward = next >= mediaLength;
      const wrapBackward = next < 0;
      const safeIndex = clampIndex(next, mediaLength);

      if (safeIndex === dataIndex && !immediate && !wrapForward && !wrapBackward) return;

      if (immediate) {
        setSuppressTransition(false);
        setVisualIndex(safeIndex);
        setDataIndex(safeIndex);
        onChangeIndex?.(safeIndex);
        return;
      }

      if (wrapForward || wrapBackward) {
        const tempVisual = wrapForward ? mediaLength : -1;
        setIsAnimating(true);
        setSuppressTransition(false);
        setVisualIndex(tempVisual);
        setDataIndex(wrapForward ? mediaLength - 1 : 0);

        clearAnimationTimeout();
        animationTimeoutRef.current = window.setTimeout(() => {
          setSuppressTransition(true);
          const finalIndex = wrapForward ? 0 : mediaLength - 1;
          setVisualIndex(finalIndex);
          setDataIndex(finalIndex);
          onChangeIndex?.(finalIndex);
          window.setTimeout(() => {
            setSuppressTransition(false);
            setIsAnimating(false);
          }, 20);
          animationTimeoutRef.current = null;
        }, SLIDE_DURATION);
        return;
      }

      setIsAnimating(true);
      setSuppressTransition(false);
      setVisualIndex(safeIndex);
      setDataIndex(safeIndex);
      onChangeIndex?.(safeIndex);

      clearAnimationTimeout();
      animationTimeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        animationTimeoutRef.current = null;
      }, SLIDE_DURATION);
    },
    [clearAnimationTimeout, dataIndex, mediaLength, onChangeIndex],
  );

  const goToNext = useCallback(() => goToIndex(dataIndex + 1, "left"), [dataIndex, goToIndex]);
  const goToPrev = useCallback(() => goToIndex(dataIndex - 1, "right"), [dataIndex, goToIndex]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => { onClose(); }, 200);
  }, [onClose]);

  return {
    visualIndex,
    dataIndex,
    isAnimating,
    isClosing,
    suppressTransition,
    slideDuration: SLIDE_DURATION,
    goToIndex,
    goToNext,
    goToPrev,
    handleClose,
  };
}
