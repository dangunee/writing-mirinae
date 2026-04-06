import { sql } from "drizzle-orm";

import { getDb } from "../db/client";

/**
 * auth.identities — server-only SQL (no client exposure).
 */

export async function findUserIdWithEmailIdentityForEmail(normalizedEmail: string): Promise<string | null> {
  const db = getDb();
  const r = await db.execute<{ id: string }>(
    sql`
      SELECT u.id::text AS id
      FROM auth.users u
      INNER JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
      WHERE lower(trim(u.email)) = ${normalizedEmail}
      LIMIT 1
    `
  );
  const row = r[0] as { id: string } | undefined;
  return row?.id ?? null;
}

export async function getIdentityProvidersForUserId(userId: string): Promise<string[]> {
  const db = getDb();
  const r = await db.execute<{ provider: string }>(
    sql`SELECT DISTINCT provider FROM auth.identities WHERE user_id = ${userId}::uuid`
  );
  return (r as { provider: string }[]).map((x) => x.provider);
}

/**
 * LINE may appear as `line` or `custom:line` (browser OAuth) in auth.identities.provider.
 */
export function isLineIdentityProvider(provider: string): boolean {
  return provider === "line" || provider === "custom:line";
}

export async function userHasLineIdentity(userId: string): Promise<boolean> {
  const providers = await getIdentityProvidersForUserId(userId);
  return providers.some(isLineIdentityProvider);
}

export async function userHasProvider(userId: string, provider: string): Promise<boolean> {
  const providers = await getIdentityProvidersForUserId(userId);
  return providers.includes(provider);
}
