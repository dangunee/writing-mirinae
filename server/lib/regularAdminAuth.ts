/**
 * Bearer auth for regular-access admin routes (Vercel BFF / Next route).
 * Set REGULAR_ADMIN_BFF_TOKEN in env; client sends Authorization: Bearer <token>.
 */
export function assertRegularAdminBff(req: Request): void {
  const expected = process.env.REGULAR_ADMIN_BFF_TOKEN?.trim();
  if (!expected) {
    throw new Error("bff_misconfigured");
  }
  const h = req.headers.get("authorization")?.trim() ?? "";
  const bearer = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
  if (bearer !== expected) {
    throw new Error("unauthorized");
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}
