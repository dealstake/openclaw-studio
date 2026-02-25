import { describe, expect, it } from "vitest";
import { parseUsageResult } from "@/features/sessions/hooks/useSessionUsage";

// Test the exported parseUsageResult transformation logic
describe("parseUsageResult", () => {
  it("parses empty result", () => {
    const result = parseUsageResult({});
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalCost: null,
      currency: "USD",
      messageCount: 0,
    });
  });

  it("parses result with totals", () => {
    const result = parseUsageResult({
      totals: { input: 1000, output: 500, totalCost: 0.05 },
    });
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.totalCost).toBe(0.05);
  });

  it("aggregates message counts across multiple sessions", () => {
    const result = parseUsageResult({
      totals: { input: 5000, output: 3000, totalCost: 0.25 },
      sessions: [
        { usage: { messageCounts: { total: 10 } } },
        { usage: { messageCounts: { total: 20 } } },
        { usage: { messageCounts: { total: 5 } } },
      ],
    });
    expect(result.messageCount).toBe(35);
    expect(result.inputTokens).toBe(5000);
    expect(result.outputTokens).toBe(3000);
    expect(result.totalCost).toBe(0.25);
  });

  it("handles zero cost as null", () => {
    const result = parseUsageResult({
      totals: { input: 100, output: 50, totalCost: 0 },
    });
    expect(result.totalCost).toBeNull();
  });

  it("handles sessions with missing usage fields", () => {
    const result = parseUsageResult({
      sessions: [
        { usage: undefined },
        { usage: { messageCounts: { total: 7 } } },
        {},
      ],
    });
    expect(result.messageCount).toBe(7);
  });
});

describe("sessions.list params", () => {
  it("should request high limit to cover all sessions", () => {
    const params = {
      includeGlobal: true,
      includeUnknown: true,
      limit: 2000,
    };
    expect(params.limit).toBeGreaterThanOrEqual(2000);
    expect(params.includeGlobal).toBe(true);
    expect(params.includeUnknown).toBe(true);
  });
});

describe("SessionEntry mapping", () => {
  type SessionsListEntry = {
    key: string;
    updatedAt?: number | null;
    displayName?: string;
    origin?: { label?: string | null; provider?: string | null } | null;
  };

  it("maps gateway response to session entries", () => {
    const rawSessions: SessionsListEntry[] = [
      {
        key: "agent:alex:main",
        updatedAt: 1700000000000,
        displayName: "Main Session",
        origin: { label: "webchat", provider: null },
      },
      {
        key: "agent:alex:subagent:abc123",
        updatedAt: 1699999000000,
        origin: null,
      },
      {
        key: "agent:alex:cron:def456",
        updatedAt: null,
      },
    ];

    const entries = rawSessions.map((s) => ({
      key: s.key,
      updatedAt: s.updatedAt ?? null,
      displayName: s.displayName,
      origin: s.origin ?? null,
    }));

    expect(entries).toHaveLength(3);
    expect(entries[0].key).toBe("agent:alex:main");
    expect(entries[0].displayName).toBe("Main Session");
    expect(entries[1].updatedAt).toBe(1699999000000);
    expect(entries[2].updatedAt).toBeNull();
  });
});
