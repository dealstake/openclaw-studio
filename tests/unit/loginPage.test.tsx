import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock sign-in methods before importing the page
vi.mock("@/lib/auth/sign-in-methods", () => ({
  getSignInMethods: vi.fn(() => ({
    google: true,
    microsoft: false,
    email: false,
  })),
}));

// Mock branding
vi.mock("@/lib/branding/config", () => ({
  BRANDING: { name: "TestBrand", tagline: "Test Tagline" },
}));

// Lazy import so mocks are in place
const { default: LoginPage } = await import("@/app/login/page");

describe("LoginPage", () => {
  it("renders the sign-in heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the brand tagline", () => {
    render(<LoginPage />);
    expect(screen.getAllByText("Test Tagline").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Google SSO as enabled link", () => {
    render(<LoginPage />);
    const links = screen.getAllByText("Continue with Google");
    const link = links.find((el) => el.closest("a"));
    expect(link).toBeDefined();
    expect(link!.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders Microsoft SSO as disabled button", () => {
    render(<LoginPage />);
    const btns = screen.getAllByText("Continue with Microsoft");
    const btn = btns.find((el) => el.closest("button"));
    expect(btn).toBeDefined();
    expect(btn!.closest("button")).toBeDisabled();
  });

  it("wraps email section in a form element", () => {
    render(<LoginPage />);
    const emailInputs = screen.getAllByPlaceholderText("Email address");
    expect(emailInputs.some((el) => el.closest("form"))).toBe(true);
  });

  it("email input has associated label", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("email input has id and name attributes", () => {
    render(<LoginPage />);
    const input = screen.getByLabelText("Email address");
    expect(input).toHaveAttribute("id", "login-email");
    expect(input).toHaveAttribute("name", "email");
  });

  it("submit button has type=submit", () => {
    render(<LoginPage />);
    const buttons = screen.getAllByRole("button", { name: /continue with email/i });
    expect(buttons.some((btn) => btn.getAttribute("type") === "submit")).toBe(true);
  });

  it("disables email input when email auth is off", () => {
    render(<LoginPage />);
    const input = screen.getByLabelText("Email address");
    expect(input).toBeDisabled();
  });
});
