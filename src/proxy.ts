import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/redirect";

// Gate barato por cookie (no toca DB). La validación real ocurre en requireUser()/requireOrg().
const PROTECTED_PREFIXES = ["/app", "/admin", "/onboarding", "/invite"];
const AUTH_PAGE_PREFIXES = ["/login", "/register"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let hasSession = false;
  try {
    hasSession = getSessionCookie(request) !== null;
  } catch {
    hasSession = false;
  }

  if (matchesPrefix(pathname, AUTH_PAGE_PREFIXES)) {
    if (hasSession) {
      const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.next();
  }

  if (matchesPrefix(pathname, PROTECTED_PREFIXES) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
