import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GatewayStatusBanner } from "@/components/GatewayStatusBanner";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("GatewayStatusBanner", () => {
  it("renders nothing when connected", () => {
    const { container } = render(<GatewayStatusBanner status="connected" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Connecting to gateway…' when connecting", () => {
    render(<GatewayStatusBanner status="connecting" />);
    expect(screen.getByText("Connecting to gateway…")).toBeInTheDocument();
  });

  it("shows 'Gateway connection lost' when disconnected", () => {
    render(<GatewayStatusBanner status="disconnected" />);
    expect(screen.getByText("Gateway connection lost")).toBeInTheDocument();
  });

  it("shows reconnect button when onReconnect provided and disconnected", () => {
    const onReconnect = vi.fn();
    render(<GatewayStatusBanner status="disconnected" onReconnect={onReconnect} />);
    const btn = screen.getByRole("button", { name: /reconnect/i });
    fireEvent.click(btn);
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it("does not show reconnect button when connecting", () => {
    const { container } = render(<GatewayStatusBanner status="connecting" onReconnect={vi.fn()} />);
    const btn = container.querySelector("button");
    expect(btn).toBeNull();
  });

  it("has alert semantics for accessibility", () => {
    const { container } = render(<GatewayStatusBanner status="disconnected" />);
    const banner = container.querySelector("[role='alert']");
    expect(banner).not.toBeNull();
  });
});
