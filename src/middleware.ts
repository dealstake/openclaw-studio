import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that do not require authentication.
// - /login: The login page itself.
// - /_next/static: Static assets (JS/CSS) - code is public, data is not.
// - /favicon.ico: Browser request.
// - /branding: Branding assets (SVG logos).
const PUBLIC_PATHS = [
  "/login",
  "/favicon.ico",
  "/branding",
];

// Helper to check if a path is public
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return true;
  }
  // Allow Next.js internal paths
  if (pathname.startsWith("/_next")) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip auth check for public paths to prevent redirect loops and allow assets
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 2. Check for Cloudflare Access JWT cookie
  const cfAuthorization = request.cookies.get("CF_Authorization");

  if (!cfAuthorization) {
    // No auth cookie -> redirect to branded login page
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated -> Allow request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (health checks)
     * - _next/image (image optimization files)
     */
    "/((?!api/health|_next/image).*)",
  ],
};
