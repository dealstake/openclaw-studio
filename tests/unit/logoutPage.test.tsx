import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LogoutPage from "@/app/logout/page";

describe("LogoutPage", () => {
  it("renders the signed-out heading", () => {
    render(<LogoutPage />);
    expect(screen.getByRole("heading", { name: /signed out/i })).toBeInTheDocument();
  });

  it("renders redirect message", () => {
    render(<LogoutPage />);
    expect(screen.getAllByText(/redirecting to sign in/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback link to login", () => {
    render(<LogoutPage />);
    const links = screen.getAllByRole("link", { name: /return to sign in/i });
    expect(links.some((link) => link.getAttribute("href") === "/login")).toBe(true);
  });

  it("renders hidden CF logout iframe", () => {
    render(<LogoutPage />);
    const iframe = document.querySelector('iframe[src="/cdn-cgi/access/logout"]');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("aria-hidden", "true");
  });

  it("exports metadata with refresh redirect", async () => {
    const { metadata } = await import("@/app/logout/page");
    expect(metadata).toBeDefined();
    expect(metadata?.other).toEqual(
      expect.objectContaining({ content: "3;url=/login" }),
    );
  });
});
