import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sign-in-methods", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("google defaults to true when env not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SSO_GOOGLE_ENABLED", "");
    const { getSignInMethods } = await import("@/lib/auth/sign-in-methods");
    expect(getSignInMethods().google).toBe(true);
  });

  it("google is false when explicitly disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SSO_GOOGLE_ENABLED", "false");
    const { getSignInMethods } = await import("@/lib/auth/sign-in-methods");
    expect(getSignInMethods().google).toBe(false);
  });

  it("microsoft defaults to false (opt-in)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SSO_MICROSOFT_ENABLED", "");
    const { getSignInMethods } = await import("@/lib/auth/sign-in-methods");
    expect(getSignInMethods().microsoft).toBe(false);
  });

  it("microsoft is true when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SSO_MICROSOFT_ENABLED", "true");
    const { getSignInMethods } = await import("@/lib/auth/sign-in-methods");
    expect(getSignInMethods().microsoft).toBe(true);
  });

  it("email defaults to false (opt-in)", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH_ENABLED", "");
    const { getSignInMethods } = await import("@/lib/auth/sign-in-methods");
    expect(getSignInMethods().email).toBe(false);
  });

  it("email is true when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH_ENABLED", "true");
    const { getSignInMethods } = await import("@/lib/auth/sign-in-methods");
    expect(getSignInMethods().email).toBe(true);
  });
});
