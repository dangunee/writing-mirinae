import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit — introspection / future migrations.
 * Source of truth for DDL is supabase/migrations/*.sql until you switch to drizzle-kit generate.
 */
export default defineConfig({
  schema: ["./db/auth-users.ts", "./db/schema.ts", "./db/newsletter-schema.ts"],
  out: "./drizzle/meta",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/writing_mirinae",
  },
});
