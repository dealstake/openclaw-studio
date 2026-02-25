import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";

describe("ChannelsPanel", () => {
  const onRefresh = vi.fn();
  afterEach(cleanup);

  it("renders loading skeletons when loading with no data", () => {
    const { container } = render(
      <ChannelsPanel snapshot={null} loading={true} error={null} onRefresh={onRefresh} />,
    );
    // CardSkeleton renders placeholder divs
    expect(container.querySelector("[class*=animate-pulse]")).toBeTruthy();
  });

  it("renders empty state when no channels", () => {
    render(
      <ChannelsPanel snapshot={{ channels: {} }} loading={false} error={null} onRefresh={onRefresh} />,
    );
    expect(screen.getByText("No channels configured")).toBeInTheDocument();
  });

  it("renders channel list", () => {
    const snapshot: ChannelsStatusSnapshot = {
      channels: {
        whatsapp: { configured: true, running: true, connected: true },
        telegram: { configured: true, running: false, connected: false },
      },
    };
    render(
      <ChannelsPanel snapshot={snapshot} loading={false} error={null} onRefresh={onRefresh} />,
    );
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();
  });

  it("renders ErrorBanner when error is present", () => {
    render(
      <ChannelsPanel snapshot={null} loading={false} error="Something broke" onRefresh={onRefresh} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("hides header when hideHeader is true but still shows refresh", () => {
    render(
      <ChannelsPanel snapshot={{ channels: {} }} loading={false} error={null} onRefresh={onRefresh} hideHeader />,
    );
    // SectionLabel "Channels" should not render
    expect(screen.queryByText(/^Channels$/)).toBeNull();
    expect(screen.getByLabelText("Refresh channels")).toBeInTheDocument();
  });
});
