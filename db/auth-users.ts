/**
 * Supabase auth.users — FK target only (no public.users).
 */
import { pgSchema, uuid } from "drizzle-orm/pg-core";

const auth = pgSchema("auth");

export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});
