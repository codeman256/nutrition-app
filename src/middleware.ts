import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Fast cookie-presence check only — real session validation happens
// server-side in requireUser(). This just keeps obvious anonymous traffic
// out of app pages.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/products/:path*", "/regimen/:path*", "/profile/:path*", "/consent"],
};
