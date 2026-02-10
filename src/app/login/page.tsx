"use client";

import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { SSOGoogleIcon } from "@/components/icons/SSOGoogleIcon";
import { SSOMicrosoftIcon } from "@/components/icons/SSOMicrosoftIcon";
import { getSignInMethods } from "@/lib/auth/sign-in-methods";
import { BRANDING } from "@/lib/branding/config";

const methods = getSignInMethods();

const DISABLED_TOOLTIP = "Your organization has disabled this sign-in method";

// TODO: Wire to actual Cloudflare Access SSO endpoints
function handleGoogleSSO() {
  window.location.href = "/cdn-cgi/access/login";
}
function handleMicrosoftSSO() {
  window.location.href = "/cdn-cgi/access/login";
}

function SSOButton({
  enabled,
  icon,
  label,
  onClick,
}: {
  enabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={enabled ? onClick : undefined}
      title={!enabled ? DISABLED_TOOLTIP : undefined}
      className={`flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--card-foreground)] transition hover:bg-[var(--muted)] ${
        !enabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" />
          <p className="text-sm tracking-widest uppercase text-[var(--muted-foreground)]">
            {BRANDING.tagline}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg space-y-5">
          <h2 className="text-center text-lg font-semibold text-[var(--card-foreground)]">
            Sign in to your account
          </h2>

          {/* SSO Buttons */}
          <div className="space-y-3">
            <SSOButton
              enabled={methods.google}
              icon={<SSOGoogleIcon />}
              label="Continue with Google"
              onClick={handleGoogleSSO}
            />
            <SSOButton
              enabled={methods.microsoft}
              icon={<SSOMicrosoftIcon />}
              label="Continue with Microsoft"
              onClick={handleMicrosoftSSO}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          {/* Email/Password */}
          <div
            className={`space-y-3 ${!methods.email ? "opacity-50" : ""}`}
            title={!methods.email ? DISABLED_TOOLTIP : undefined}
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!methods.email}
                className={`w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-3 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
                  !methods.email ? "cursor-not-allowed" : ""
                }`}
              />
            </div>
            <button
              type="button"
              disabled={!methods.email}
              title={!methods.email ? DISABLED_TOOLTIP : undefined}
              className={`flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 ${
                !methods.email ? "cursor-not-allowed" : ""
              }`}
            >
              Continue with Email
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[var(--muted-foreground)] space-y-1">
          <p>Powered by OpenClaw</p>
          <p>&copy; {new Date().getFullYear()} {BRANDING.name}</p>
        </div>
      </div>
    </div>
  );
}
