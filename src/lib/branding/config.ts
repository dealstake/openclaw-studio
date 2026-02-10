/**
 * Centralized branding configuration.
 * Swap this file to rebrand for a different client.
 */
export const BRANDING = {
  /** Full company name */
  name: "Trident Funding Solutions",
  /** Short name for headers / tight spaces */
  shortName: "TRIDENT FUNDING SOLUTIONS",
  /** Subtitle shown in italic gold */
  subtitle: "Funding Solutions",
  /** Dashboard subtitle */
  tagline: "Agent Control Center",
  /** HTML page title */
  pageTitle: "Trident Control Center",
  /** Meta description */
  pageDescription:
    "AI agent operations dashboard for Trident Funding Solutions.",
  /** Cloudflare Access team domain (used to build IdP login URLs) */
  cfTeamDomain: "tridentfundingsolutions.cloudflareaccess.com",
  /** Cloudflare Access logout URL */
  logoutUrl:
    "https://tridentfundingsolutions.cloudflareaccess.com/cdn-cgi/access/logout",
  /** Cloudflare Access identity endpoint */
  identityUrl: "/cdn-cgi/access/get-identity",

  colors: {
    navy: "#0F1B2D",
    gold: "#D4A843",
    offWhite: "#E8DCC8",
  },
} as const;
