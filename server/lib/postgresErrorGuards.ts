/**
 * postgres-js throws objects with a string `code` (e.g. "23505").
 * Do not use `instanceof PostgresError`: in some Next/Vercel bundles the constructor can be undefined,
 * which throws TypeError: Right-hand side of 'instanceof' is not an object.
 */

export function isPostgresErrorLike(e: unknown): e is { code: string; message?: string; detail?: string } {
  if (e === null || e === undefined || typeof e !== "object") return false;
  return "code" in e && typeof (e as { code: unknown }).code === "string";
}

export function isPostgresUniqueViolation(e: unknown): boolean {
  return isPostgresErrorLike(e) && e.code === "23505";
}

export function getPostgresErrorDetail(e: unknown): string | undefined {
  if (!isPostgresErrorLike(e)) return undefined;
  const d = (e as { detail?: unknown }).detail;
  return typeof d === "string" ? d : undefined;
}

export function pgErrMeta(e: unknown): { message: string; pgCode?: string } {
  if (isPostgresErrorLike(e)) {
    const msg =
      "message" in e && typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : String(e);
    return { message: msg, pgCode: e.code };
  }
  if (e instanceof Error) {
    return { message: e.message };
  }
  return { message: String(e) };
}
