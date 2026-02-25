import { describe, expect, it } from "vitest";

import { MODAL_OVERLAY_CLASSES } from "@/components/ModalOverlay";

describe("ModalOverlay", () => {
  it("exports MODAL_OVERLAY_CLASSES with z-index modal token", () => {
    expect(MODAL_OVERLAY_CLASSES).toContain("z-[var(--z-modal)]");
  });

  it("includes backdrop blur", () => {
    expect(MODAL_OVERLAY_CLASSES).toContain("backdrop-blur-sm");
  });

  it("includes bg-background/70", () => {
    expect(MODAL_OVERLAY_CLASSES).toContain("bg-background/70");
  });

  it("includes animation classes", () => {
    expect(MODAL_OVERLAY_CLASSES).toContain("data-[state=open]:animate-in");
    expect(MODAL_OVERLAY_CLASSES).toContain("data-[state=closed]:animate-out");
    expect(MODAL_OVERLAY_CLASSES).toContain("data-[state=open]:fade-in-0");
    expect(MODAL_OVERLAY_CLASSES).toContain("data-[state=closed]:fade-out-0");
  });

  it("uses fixed positioning with inset-0", () => {
    expect(MODAL_OVERLAY_CLASSES).toContain("fixed");
    expect(MODAL_OVERLAY_CLASSES).toContain("inset-0");
  });
});
