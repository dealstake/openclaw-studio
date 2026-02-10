import { headers } from "next/headers";
import { Mail, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { SSOGoogleIcon } from "@/components/brand/SSOGoogleIcon";
import { SSOMicrosoftIcon } from "@/components/brand/SSOMicrosoftIcon";
import { getSignInMethods } from "@/lib/auth/sign-in-methods";
import { BRANDING } from "@/lib/branding/config";

const DISABLED_TOOLTIP = "Your organization has disabled this sign-in method";

const CF_TEAM_DOMAIN =
  process.env.NEXT_PUBLIC_CF_TEAM_DOMAIN || BRANDING.cfTeamDomain;
const CF_GOOGLE_IDP_ID = process.env.NEXT_PUBLIC_CF_GOOGLE_IDP_ID || "";
const CF_MICROSOFT_IDP_ID = process.env.NEXT_PUBLIC_CF_MICROSOFT_IDP_ID || "";

function buildLoginUrl(hostname: string, idpId?: string): string {
  if (!CF_TEAM_DOMAIN || !hostname) return "/";
  const base = `https://${CF_TEAM_DOMAIN}/cdn-cgi/access/login/${hostname}`;
  const params = new URLSearchParams({ redirect_url: "/" });
  if (idpId) params.set("idp", idpId);
  return `${base}?${params}`;
}

function SSOButton({
  enabled,
  icon,
  label,
  href,
}: {
  enabled: boolean;
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  const base =
    "flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground";

  if (!enabled) {
    return (
      <span
        title={DISABLED_TOOLTIP}
        className={`${base} cursor-not-allowed opacity-50`}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <a href={href} className={`${base} transition hover:bg-muted`}>
      {icon}
      {label}
    </a>
  );
}

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Build IdP login URLs using the public-facing hostname.
  // Behind Cloudflare/reverse proxy, the real hostname is in x-forwarded-host.
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const hostname = host.split(":")[0]; // strip port if present

  const methods = getSignInMethods();
  const googleUrl = buildLoginUrl(hostname, CF_GOOGLE_IDP_ID || undefined);
  const microsoftUrl = buildLoginUrl(hostname, CF_MICROSOFT_IDP_ID || undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" />
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {BRANDING.tagline}
          </p>
        </div>

        {/* Card */}
        <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-lg">
          <h2 className="text-center text-lg font-semibold text-card-foreground">
            Sign in to your account
          </h2>

          {/* SSO Buttons */}
          <div className="space-y-3">
            <SSOButton
              enabled={methods.google}
              icon={<SSOGoogleIcon />}
              label="Continue with Google"
              href={googleUrl}
            />
            <SSOButton
              enabled={methods.microsoft}
              icon={<SSOMicrosoftIcon />}
              label="Continue with Microsoft"
              href={microsoftUrl}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email field — disabled by default */}
          <div
            className={`space-y-3 ${!methods.email ? "opacity-50" : ""}`}
            title={!methods.email ? DISABLED_TOOLTIP : undefined}
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                disabled={!methods.email}
                className="w-full rounded-lg border border-border bg-input py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
              />
            </div>
            <button
              type="button"
              disabled={!methods.email}
              title={!methods.email ? DISABLED_TOOLTIP : undefined}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed"
            >
              Continue with Email
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-1 text-center text-xs text-muted-foreground">
          <p>Powered by OpenClaw</p>
          <p>
            &copy; {new Date().getFullYear()} {BRANDING.name}
          </p>
        </div>
      </div>
    </div>
  );
}
