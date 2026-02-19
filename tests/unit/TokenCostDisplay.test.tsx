import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  TokenCostDisplay,
  formatTokenCount,
} from "@/components/chat/TokenCostDisplay";

describe("TokenCostDisplay", () => {
  afterEach(() => cleanup());

  it("renders nothing when no token data", () => {
    const { container } = render(<TokenCostDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when both undefined", () => {
    const { container } = render(
      <TokenCostDisplay tokensIn={undefined} tokensOut={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders only tokensIn when tokensOut is undefined", () => {
    render(<TokenCostDisplay tokensIn={500} />);
    expect(screen.getByText("500 in")).toBeTruthy();
    expect(screen.queryByText(/\bout\b/)).toBeNull();
  });

  it("renders only tokensOut when tokensIn is undefined", () => {
    render(<TokenCostDisplay tokensOut={1200} />);
    expect(screen.getByText("1.2K out")).toBeTruthy();
    expect(screen.queryByText(/\d+ in\b/)).toBeNull();
  });

  it("renders both with separator", () => {
    render(<TokenCostDisplay tokensIn={800} tokensOut={3400} />);
    expect(screen.getByText("800 in")).toBeTruthy();
    expect(screen.getByText("·")).toBeTruthy();
    expect(screen.getByText("3.4K out")).toBeTruthy();
  });

  it("renders cache hit rate badge", () => {
    render(
      <TokenCostDisplay tokensIn={1000} tokensOut={2000} cacheHitRate={0.85} />,
    );
    expect(screen.getByText("85% cache")).toBeTruthy();
  });

  it("hides cache badge when rate is 0", () => {
    render(
      <TokenCostDisplay tokensIn={1000} tokensOut={2000} cacheHitRate={0} />,
    );
    expect(screen.queryByText(/cache/)).toBeNull();
  });

  it("hides cache badge when rate is undefined", () => {
    render(<TokenCostDisplay tokensIn={1000} tokensOut={2000} />);
    expect(screen.queryByText(/cache/)).toBeNull();
  });

  it("applies custom className", () => {
    const { container } = render(
      <TokenCostDisplay tokensIn={100} className="mt-2" />,
    );
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain("mt-2");
  });

  it("handles zero tokens", () => {
    render(<TokenCostDisplay tokensIn={0} tokensOut={0} />);
    expect(screen.getByText("0 in")).toBeTruthy();
    expect(screen.getByText("0 out")).toBeTruthy();
  });
});

describe("formatTokenCount", () => {
  it("formats numbers < 1000 as-is", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokenCount(1000)).toBe("1K");
    expect(formatTokenCount(1200)).toBe("1.2K");
    expect(formatTokenCount(3400)).toBe("3.4K");
    expect(formatTokenCount(10000)).toBe("10K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokenCount(1000000)).toBe("1M");
    expect(formatTokenCount(1500000)).toBe("1.5M");
    expect(formatTokenCount(2000000)).toBe("2M");
  });
});
