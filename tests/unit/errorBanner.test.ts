import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBanner } from "@/components/ErrorBanner";

afterEach(cleanup);

function renderBanner(props: Partial<Parameters<typeof ErrorBanner>[0]> = {}) {
  return render(
    createElement(ErrorBanner, { message: "Something went wrong", ...props })
  );
}

describe("ErrorBanner", () => {
  it("renders the error message", () => {
    renderBanner();
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("has role=alert for accessibility", () => {
    renderBanner();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("does not render retry button when onRetry is not provided", () => {
    renderBanner();
    expect(screen.queryByLabelText("Retry")).toBeNull();
  });

  it("renders retry button when onRetry is provided", () => {
    renderBanner({ onRetry: () => {} });
    expect(screen.getByLabelText("Retry")).toBeDefined();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    renderBanner({ onRetry });
    fireEvent.click(screen.getByLabelText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("applies custom className", () => {
    renderBanner({ className: "extra-class" });
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("extra-class");
  });

  it("renders custom message text", () => {
    renderBanner({ message: "Network error" });
    expect(screen.getByText("Network error")).toBeDefined();
  });
});
