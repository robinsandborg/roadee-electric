import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JoinSpaceForm from "./JoinSpaceForm";

describe("JoinSpaceForm", () => {
  it("shows inline validation for empty values", () => {
    const onSubmit = vi.fn();

    render(<JoinSpaceForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Join space" }));

    expect(screen.getByRole("alert").textContent).toContain("Enter a space slug or invite link.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("normalizes and submits a pasted space link", () => {
    const onSubmit = vi.fn();

    render(<JoinSpaceForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Space link or slug"), {
      target: { value: "/s/My Space" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join space" }));

    expect(onSubmit).toHaveBeenCalledWith("my-space");
  });
});
