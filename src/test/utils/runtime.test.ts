import { describe, expect, it } from "vitest";

import { isLowBandwidthMobileClient } from "../../utils/runtime";

const setWindowWidth = (value: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value,
  });
};

const setSaveData = (value: boolean | undefined) => {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    writable: true,
    value: value === undefined ? undefined : { saveData: value },
  });
};

describe("runtime utils", () => {
  it("returns false for non-mobile clients without save-data", () => {
    setWindowWidth(1024);
    setSaveData(false);

    expect(isLowBandwidthMobileClient()).toBe(false);
  });

  it("returns true for mobile width", () => {
    setWindowWidth(375);
    setSaveData(false);

    expect(isLowBandwidthMobileClient()).toBe(true);
  });

  it("returns true when save-data is enabled", () => {
    setWindowWidth(1280);
    setSaveData(true);

    expect(isLowBandwidthMobileClient()).toBe(true);
  });
});
