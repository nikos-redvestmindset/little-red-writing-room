import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
  useRouter: () => ({ push: vi.fn() }),
}));

import { AppSidebar } from "@/components/app-sidebar";

describe("AppSidebar", () => {
  it("renders the app title", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Little Red Writing Room")).toBeInTheDocument();
  });

  it("renders the new chat button", () => {
    render(<AppSidebar />);
    expect(screen.getByText("New chat")).toBeInTheDocument();
  });

  it("renders thread list from dummy data", () => {
    render(<AppSidebar />);
    expect(screen.getByText("PurpleFrog's motivations")).toBeInTheDocument();
    expect(
      screen.getByText("SnowRaven character analysis")
    ).toBeInTheDocument();
    expect(screen.getByText("OchraMags emotional arc")).toBeInTheDocument();
  });

  it("shows the Recent section header", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("renders the upload files button", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Upload files")).toBeInTheDocument();
  });

  it("renders the user menu", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Story Writer")).toBeInTheDocument();
  });
});
