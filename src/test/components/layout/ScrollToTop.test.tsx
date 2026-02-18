import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { locationState } = vi.hoisted(() => ({
  locationState: {
    pathname: "/home",
  },
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => locationState,
}));

import ScrollToTop from "../../../components/layout/ScrollToTop";

describe("ScrollToTop", () => {
  beforeEach(() => {
    locationState.pathname = "/home";
    window.scrollTo = vi.fn();
  });

  it("scrolls to top on mount and pathname changes", () => {
    const { rerender } = render(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "instant",
    });

    locationState.pathname = "/photos";
    rerender(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
});
