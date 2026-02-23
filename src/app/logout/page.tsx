import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";

/**
 * Logout page — server component (no JS needed).
 *
 * - Hidden iframe hits /cdn-cgi/access/logout to clear the CF_Authorization cookie
 * - Meta refresh redirects to /login after 3 seconds (via Next.js metadata)
 * - Manual link as fallback
 */
export const metadata: Metadata = {
  other: {
    "http-equiv": "refresh",
    content: "3;url=/login",
  },
};

export default function LogoutPage() {
  return (
    <AuthLayout>
      {/* Clear CF Access session via hidden iframe */}
      <iframe
        title="Cloudflare Access logout"
        src="/cdn-cgi/access/logout"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        sandbox=""
      />

      {/* Card */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <h2 className="text-xl font-semibold text-card-foreground">
          You&apos;ve been signed out
        </h2>
        <p className="text-sm text-muted-foreground">
          Redirecting to sign in…
        </p>
        <a
          href="/login"
          className="mt-2 inline-block text-sm font-medium text-primary-text underline underline-offset-4 transition hover:brightness-110"
        >
          Return to sign in
        </a>
      </div>
    </AuthLayout>
  );
}
