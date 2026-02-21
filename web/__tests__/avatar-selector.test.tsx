import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AvatarSelector } from "@/components/avatar-selector";

describe("AvatarSelector", () => {
  it("renders all character avatars", () => {
    render(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
    expect(screen.getByText("SnowRaven")).toBeInTheDocument();
    expect(screen.getByText("OchraMags")).toBeInTheDocument();
    expect(screen.getByText("MyaxSerp")).toBeInTheDocument();
  });

  it("renders the selection prompt", () => {
    render(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(
      screen.getByText("Who would you like to talk to?")
    ).toBeInTheDocument();
  });

  it("calls onSelect when a character is clicked", () => {
    const onSelect = vi.fn();
    render(<AvatarSelector selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("PurpleFrog"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].id).toBe("purplefrog");
  });

  it("renders character descriptions", () => {
    render(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(
      screen.getByText(/Fierce, impulsive, protective/)
    ).toBeInTheDocument();
  });
});
