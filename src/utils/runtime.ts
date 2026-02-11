const MOBILE_WIDTH_BREAKPOINT = 640;

export const isLowBandwidthMobileClient = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const saveData = navigator.connection?.saveData === true;
  return window.innerWidth < MOBILE_WIDTH_BREAKPOINT || saveData;
};
