import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { LoginForm } from "@/components/login-form";

describe("LoginForm", () => {
  it("renders the email input", () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });

  it("renders the password input", () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("renders the sign-in button", () => {
    render(<LoginForm />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("renders the Google sign-in button", () => {
    render(<LoginForm />);
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });

  it("renders the welcome heading", () => {
    render(<LoginForm />);
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });
});
