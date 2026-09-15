// Solo rutas internas relativas: evita open redirects vía ?next=https://evil.com o //evil.com
export function sanitizeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/api/") || next.startsWith("/login") || next.startsWith("/register")) {
    return fallback;
  }
  return next;
}
