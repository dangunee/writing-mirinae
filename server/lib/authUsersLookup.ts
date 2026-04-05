import { sql } from "drizzle-orm";

import { getDb } from "../db/client";

/**
 * Resolve auth.users.id by email (server-only). Used for password reset; never exposed to clients.
 */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const r = await db.execute<{ id: string }>(
    sql`SELECT id::text AS id FROM auth.users WHERE lower(email) = ${normalized} LIMIT 1`
  );
  const row = r[0] as { id: string } | undefined;
  return row?.id ?? null;
}
