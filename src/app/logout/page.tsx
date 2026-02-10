import { BrandMark } from "@/components/brand/BrandMark";

/**
 * Logout page — server component (no JS needed).
 *
 * - Hidden iframe hits /cdn-cgi/access/logout to clear the CF_Authorization cookie
 * - Meta refresh redirects to /login after 3 seconds
 * - Manual link as fallback
 */
export default function LogoutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Clear CF Access session via hidden iframe */}
      <iframe
        title="Cloudflare Access logout"
        src="/cdn-cgi/access/logout"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        sandbox=""
      />

      {/* Auto-redirect after 3s (no JS required) */}
      <meta httpEquiv="refresh" content="3;url=/login" />

      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" />
        </div>

        {/* Card */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-card-foreground">
            You&apos;ve been signed out
          </h2>
          <p className="text-sm text-muted-foreground">
            Redirecting to sign in…
          </p>
          <a
            href="/login"
            className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4 transition hover:brightness-110"
          >
            Return to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
