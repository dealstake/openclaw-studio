import { describe, expect, it } from "vitest";

/**
 * TokenProgressBar fill logic unit tests.
 * We test the pure calculation logic extracted from the component's useMemo.
 */

function computeFills(used: number, limit: number | undefined) {
  if (!limit || limit <= 0)
    return { pct: 0, fillGreen: "0%", fillYellow: "0%", fillRed: "0%" };
  const p = Math.min(100, Math.round((used / limit) * 100));

  let fG: string;
  let fY: string;
  let fR: string;
  if (p <= 60) {
    fG = `${(p / 60) * 100}%`;
    fY = "0%";
    fR = "0%";
  } else if (p <= 80) {
    fG = "100%";
    fY = `${((p - 60) / 20) * 100}%`;
    fR = "0%";
  } else {
    fG = "100%";
    fY = "100%";
    fR = `${((p - 80) / 20) * 100}%`;
  }
  return { pct: p, fillGreen: fG, fillYellow: fY, fillRed: fR };
}

describe("TokenProgressBar fill calculations", () => {
  it("returns zeros when limit is undefined", () => {
    const r = computeFills(1000, undefined);
    expect(r.pct).toBe(0);
    expect(r.fillGreen).toBe("0%");
    expect(r.fillYellow).toBe("0%");
    expect(r.fillRed).toBe("0%");
  });

  it("returns zeros when limit is 0", () => {
    const r = computeFills(500, 0);
    expect(r.pct).toBe(0);
  });

  it("returns zeros when limit is negative", () => {
    const r = computeFills(500, -100);
    expect(r.pct).toBe(0);
  });

  it("computes 0% used correctly", () => {
    const r = computeFills(0, 10000);
    expect(r.pct).toBe(0);
    expect(r.fillGreen).toBe("0%");
    expect(r.fillYellow).toBe("0%");
    expect(r.fillRed).toBe("0%");
  });

  it("computes green zone (30%)", () => {
    const r = computeFills(3000, 10000);
    expect(r.pct).toBe(30);
    expect(r.fillGreen).toBe("50%"); // 30/60 = 50%
    expect(r.fillYellow).toBe("0%");
    expect(r.fillRed).toBe("0%");
  });

  it("computes green zone boundary (60%)", () => {
    const r = computeFills(6000, 10000);
    expect(r.pct).toBe(60);
    expect(r.fillGreen).toBe("100%");
    expect(r.fillYellow).toBe("0%");
    expect(r.fillRed).toBe("0%");
  });

  it("computes yellow zone (61%)", () => {
    const r = computeFills(6100, 10000);
    expect(r.pct).toBe(61);
    expect(r.fillGreen).toBe("100%");
    expect(r.fillYellow).toBe("5%"); // (61-60)/20 = 5%
    expect(r.fillRed).toBe("0%");
  });

  it("computes yellow zone boundary (80%)", () => {
    const r = computeFills(8000, 10000);
    expect(r.pct).toBe(80);
    expect(r.fillGreen).toBe("100%");
    expect(r.fillYellow).toBe("100%");
    expect(r.fillRed).toBe("0%");
  });

  it("computes red zone (81%)", () => {
    const r = computeFills(8100, 10000);
    expect(r.pct).toBe(81);
    expect(r.fillGreen).toBe("100%");
    expect(r.fillYellow).toBe("100%");
    expect(r.fillRed).toBe("5%"); // (81-80)/20 = 5%
  });

  it("computes 100% used", () => {
    const r = computeFills(10000, 10000);
    expect(r.pct).toBe(100);
    expect(r.fillGreen).toBe("100%");
    expect(r.fillYellow).toBe("100%");
    expect(r.fillRed).toBe("100%");
  });

  it("caps at 100% when over limit", () => {
    const r = computeFills(15000, 10000);
    expect(r.pct).toBe(100);
    expect(r.fillRed).toBe("100%");
  });
});
