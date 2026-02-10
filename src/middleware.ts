import { NextRequest, NextResponse } from "next/server";

/**
 * Auth middleware — replaces Cloudflare Access as the request gatekeeper.
 *
 * CF Access still handles the OAuth flow and issues the CF_Authorization JWT,
 * but it no longer blocks unauthenticated requests at the edge. Instead,
 * this middleware checks for the cookie and redirects to /login when missing.
 *
 * This gives us full control over the login/logout UX (branded pages)
 * while keeping CF Access as the identity provider.
 */

const PUBLIC_PATHS = ["/login", "/logout"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without auth
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check for CF_Authorization cookie
  const cfAuth = request.cookies.get("CF_Authorization");
  if (cfAuth?.value) {
    return NextResponse.next();
  }

  // Unauthenticated API requests get 401 (not a redirect)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Everything else → redirect to branded login
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico, branding/ (public assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|branding/).*)",
  ],
};
