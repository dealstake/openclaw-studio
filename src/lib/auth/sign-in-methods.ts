/**
 * Sign-in method configuration.
 *
 * Reads from environment variables to determine which SSO providers
 * are enabled. Cloudflare Access handles the actual authentication —
 * these flags only control which buttons are shown/enabled on the login page.
 *
 * TODO: Wire to actual SSO providers via Cloudflare Access Application configuration
 * See GitHub issue #XX for full SSO integration roadmap
 */

export type SignInMethods = {
  google: boolean;
  microsoft: boolean;
  email: boolean;
};

export function getSignInMethods(): SignInMethods {
  return {
    google: process.env.NEXT_PUBLIC_SSO_GOOGLE_ENABLED !== "false",
    microsoft: process.env.NEXT_PUBLIC_SSO_MICROSOFT_ENABLED === "true",
    email: process.env.NEXT_PUBLIC_EMAIL_AUTH_ENABLED === "true",
  };
}
