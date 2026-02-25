import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChannelStatusPills } from "@/features/channels/components/ChannelStatusPills";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";

describe("ChannelStatusPills", () => {
  afterEach(cleanup);

  it("returns null when loading", () => {
    const { container } = render(
      <ChannelStatusPills snapshot={null} loading={true} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no channels", () => {
    const { container } = render(
      <ChannelStatusPills snapshot={{ channels: {} }} loading={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pills for active channels", () => {
    const snapshot: ChannelsStatusSnapshot = {
      channels: {
        whatsapp: { configured: true, running: true, connected: true },
        telegram: { configured: true, running: false, connected: false },
      },
    };
    render(<ChannelStatusPills snapshot={snapshot} loading={false} />);
    expect(screen.getByText("WA")).toBeInTheDocument();
    expect(screen.getByText("TG")).toBeInTheDocument();
  });

  it("skips channels with off health", () => {
    const snapshot: ChannelsStatusSnapshot = {
      channels: {
        whatsapp: { configured: true, running: true, connected: true },
        discord: {},
      },
    };
    render(<ChannelStatusPills snapshot={snapshot} loading={false} />);
    expect(screen.getByText("WA")).toBeInTheDocument();
    expect(screen.queryByText("DC")).not.toBeInTheDocument();
  });

  it("renders title with label and health", () => {
    const snapshot: ChannelsStatusSnapshot = {
      channels: {
        whatsapp: { configured: true, running: true, connected: true },
      },
    };
    render(<ChannelStatusPills snapshot={snapshot} loading={false} />);
    expect(screen.getByTitle("WhatsApp: connected")).toBeInTheDocument();
  });
});
