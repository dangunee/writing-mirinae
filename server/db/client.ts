import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../../db/schema";

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;

/** Server-only: service-role Postgres URL (Supabase pooler or direct). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for API routes");
  }
  if (!_db) {
    const client = postgres(url, {
      ssl: "require",
      max: 1,
      prepare: false,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}
