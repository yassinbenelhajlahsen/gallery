import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FloatingInput } from "../../../components/ui/FloatingInput";

describe("FloatingInput", () => {
  it("renders label with required marker and updates value", () => {
    const onChange = vi.fn();

    render(
      <FloatingInput
        id="title"
        type="text"
        label="Title*"
        value=""
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText("Title *") as HTMLInputElement;
    expect(input.required).toBe(true);

    fireEvent.change(input, { target: { value: "Hello" } });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("shows error message when provided", () => {
    render(
      <FloatingInput
        id="password"
        type="password"
        label="Password"
        value=""
        onChange={() => {}}
        error="Wrong password"
      />,
    );

    expect(screen.getByText("Wrong password")).toBeInTheDocument();
  });
});
