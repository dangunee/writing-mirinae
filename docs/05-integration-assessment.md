# Integration Assessment: Writing Schema vs mirinae.jp Existing Supabase/Postgres

**Scope:** Compare `writing-mirinae` baseline migration (`supabase/migrations/20260327120000_platform_and_writing_schema.sql`) and Drizzle `db/schema.ts` against the **quiz / apps.mirinae.jp** Supabase usage captured in the **`quiz-mirinae`** repository (SQL migrations, `supabase-schema.sql`, `AUTH_SETUP.md`, `ADMIN_SETUP.md`).

**Limitation:** This assessment is based on **repository SQL and docs only**, not a live `information_schema` dump from production. Production may have additional ad-hoc objects; validate with `supabase db dump` or SQL introspection before applying anything.

**Product scope:** Shared platform DB work targets **paid foundations** (writing, future paid apps). **Public-read** surfaces (Q&A, dailylife) are **not** expected to join the entitlement model yet; **quiz** may align later when a paid subscription exists — see [`07-platform-scope.md`](./07-platform-scope.md).

---

## 1. What the writing work is targeting today

| Interpretation | Evidence |
|----------------|----------|
| **Designed like a greenfield / new Supabase project** | Baseline creates **`public.users`** with `email`, `password_hash`, and standalone **`oauth_accounts`** / **`password_reset_tokens`**. That mirrors a **custom auth** app, not Supabase Auth’s `auth.users`. |
| **Production mirinae is an existing shared platform database** | **`quiz-mirinae`** consistently uses **`auth.users(id)`** as the only user PK for `essay_submissions`, `customer_profiles`, `ondoku_submissions`, `writing_visibility_student`, `enrollment_history`, etc. **`AUTH_SETUP.md`** documents Supabase Auth + `apps.mirinae.jp`. |

**Conclusion:** The current writing baseline is **not aligned** with the existing shared Supabase model. Treat it as a **logical schema spec** until it is **rebased onto `auth.users`** (and optional `public` profile extensions). **Do not** apply the baseline wholesale to the **same** database that already powers quiz/ondoku/writing visibility without an integration pass.

---

## 2. Side-by-side comparison

### Auth / users

| Existing (quiz-mirinae) | Writing baseline |
|-------------------------|------------------|
| **`auth.users`** (Supabase Auth) | **`public.users`** with passwords |
| No `public.users` table in tracked SQL | **`oauth_accounts`**, **`password_reset_tokens`** parallel to Auth features |

**Conflict:** **Duplicate identity model.** Two sources of truth if both exist.

### Payments / commerce

| Existing | Writing baseline |
|----------|------------------|
| **`customer_profiles`**: `payment_status`, `plan_type`, `course_type`, etc. (text checks, not Stripe ids) | **`products`**, **`payment_orders`**, **`entitlements`** with Stripe columns + catalog CHECKs |
| No `stripe_*` tables in searched SQL | **`stripe_webhook_events`**, unique Stripe ids on orders |

**Conflict:** **Conceptual overlap** (who paid / what access) without name collision. Requires a **single business rule** for whether new purchases update **`customer_profiles`**, only **`entitlements`**, or both.

### Roles / admin

| Existing | Writing baseline |
|----------|------------------|
| **Admin API**: `ADMIN_SECRET` + Bearer/cookie (`lib/admin-auth.ts`); not stored in Postgres as `user_role` | **`users.role`**: `student` / `teacher` / `admin` enum |
| **RLS** uses `auth.uid()` and `auth.role() = 'service_role'` | Designed for **backend API** auth; RLS not in baseline |

**Conflict:** **Two admin models** (env secret vs DB role). Not a table-name clash, but **authorization design** must be unified for teachers/admins.

### Quiz / content / analytics

| Existing | Writing baseline |
|----------|------------------|
| `explanation_overrides`, `qna_posts`, `app_analytics`, `assignment_example_overrides`, `seikatsu_items` | None of these names in writing baseline |

**Conflict:** None for names.

### Writing-related (legacy in shared DB)

| Existing | Writing baseline |
|----------|------------------|
| **`writing_visibility`**, **`writing_visibility_student`** (period/item visibility, `auth.users`) | **`writing` schema**: `courses`, `sessions`, `submissions`, `corrections`, … |

**Conflict:** **Parallel “writing” product models.** Legacy is **period_index / item_index** + visibility tables. New model is **course / session / entitlement**. **No PostgreSQL name collision** (`public.writing_visibility` vs `writing.courses`), but **product and migration strategy** must decide: coexist, migrate, or deprecate.

### Essay / submissions

| Existing | Writing baseline |
|----------|------------------|
| **`essay_submissions`** (`user_id` → `auth.users`, period/item) | **`writing.submissions`** (session-based, `writing` schema) |

**Conflict:** Different tables; **same human product area** (作文). Coexistence or consolidation is a **product decision**, not only a DDL issue.

---

## 3. Concrete conflicts (DDL / constraints)

| Issue | Severity |
|-------|----------|
| **`public.users` vs `auth.users`** | **Blocker** for shared DB if baseline creates `public.users` as primary identity |
| **`oauth_accounts` / `password_reset_tokens`** | **Redundant** with Supabase Auth (and confusing operationally) |
| **`CREATE TYPE ... AS ENUM`** names (`user_role`, `payment_status`, …) | **Risk** if identical type names already exist in DB — verify before `CREATE TYPE` |
| **`CREATE SCHEMA writing`** | **Low risk** if schema `writing` does not exist; **verify** first |
| **`writing.*` vs `writing_visibility*`** | **No identifier collision**; **workflow** overlap only |
| **`products` / `payment_orders`** | **No name clash** found in quiz SQL; safe as **new tables** if names unused |

---

## 4. Recommendations

### 4.1 Is it safe to apply “as new schema additions”?

**Partially, with conditions:**

- **Safe (typically additive):** `CREATE SCHEMA IF NOT EXISTS writing`, new enums **if names don’t exist**, `products`, `payment_orders`, `entitlements`, `stripe_webhook_events`, and **`writing.*` tables** — **provided all user FKs point to `auth.users(id)`** (or a single approved profile table), **not** `public.users`.

- **Not safe as-is:** **`CREATE TABLE public.users`** and related custom auth tables on the shared Supabase project.

### 4.2 Requires integration changes first

**Yes**, before any production migration:

1. **Replace `public.users`** in the design with **`auth.users`** for every `user_id` FK (`payment_orders`, `entitlements`, `writing.courses`, `writing.submissions`, `writing.corrections`, etc.).
2. **Remove or never create** `oauth_accounts` / `password_reset_tokens` in `public` if Supabase Auth is the system of record.
3. **Decide** how **`customer_profiles`** relates to **`entitlements`** / new writing courses (mirror fields? link by `user_id` only?).
4. **Decide** teacher **`user_role`**: store in **`public`** extension table (e.g. `writing_teachers(user_id uuid primary key references auth.users)`) or JWT claims — avoid conflicting with today’s **ADMIN_SECRET** pattern until unified.
5. **Legacy writing:** Document whether **`essay_submissions`** + **`writing_visibility*`** stay in parallel with **`writing.*`** or get a migration path.

### 4.3 Baseline replacement vs delta migration

| Situation | Action |
|-----------|--------|
| **Empty / new Supabase project** (no `auth` users yet, no quiz tables) | Baseline could be adapted once rebased on **`auth.users`**; still prefer Supabase Auth over `public.users`. |
| **Existing mirinae shared DB (quiz / ondoku / legacy writing already live)** | **Do not** “replace” the historical migration chain. **Do not** run the current baseline file if it **`CREATE TABLE users`** in `public`. Use a **delta migration** (new timestamped file) that only adds **non-conflicting** objects and uses **`auth.users`**. |

---

## 5. Follow-up migration plan (delta-only outline)

**Prerequisites:** Snapshot backup; run on staging; introspect `SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');` and `information_schema.tables` for conflicts.

1. **Enums**  
   - `CREATE TYPE ...` only for names that do not exist; use `DO $$ ... EXCEPTION` or manual checks if your tooling requires idempotency.

2. **Commerce (additive)**  
   - `CREATE TABLE IF NOT EXISTS products` … (or `CREATE TABLE` without IF NOT EXISTS in a one-shot migration).  
   - `payment_orders`, `entitlements`, `stripe_webhook_events` with **`user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`**.

3. **Writing schema**  
   - `CREATE SCHEMA IF NOT EXISTS writing;`  
   - Create `writing.courses`, `writing.sessions`, … with **`user_id` → `auth.users`**, not `public.users`.  
   - Reuse trigger logic from baseline but **qualified function names** as already used (`writing.fn_*`).

4. **Seed**  
   - `INSERT INTO products ... ON CONFLICT (sku) DO NOTHING` (as in baseline).

5. **RLS (optional phase)**  
   - Align with [`04-decisions-and-policies.md`](./04-decisions-and-policies.md): policies on `writing.*` using `auth.uid()` if client access is ever allowed.

6. **Do not drop** `essay_submissions`, `writing_visibility*`, or `customer_profiles` without an explicit product migration.

---

## 6. Summary

| Question | Answer |
|----------|--------|
| New project vs shared DB? | Baseline **reads like** a new DB; **mirinae production pattern** in-repo is **shared Supabase + `auth.users`**. |
| Apply baseline as-is? | **No** on shared DB — **`public.users`** and duplicate auth tables are the main blockers. |
| Additive writing + commerce? | **Yes, after** rebasing FKs to **`auth.users`** and resolving overlap with **`customer_profiles`** / legacy writing. |
| Replace baseline file in repo? | **Keep** baseline as **reference**; for production use, add **new delta SQL** and update Drizzle to **`auth.users`**-centric profile/FKs (separate PR). |

**Next engineering steps (not routes):** (1) Confirm production Supabase project id and list existing tables/types. (2) Produce one **`YYYYMMDDHHMMSS_writing_platform_integration.sql`** that implements §5. (3) Update `db/schema.ts` to match (no `public.users` table; use Supabase-style references or `uuid` without FK in Drizzle if `auth.users` is not exposed to Drizzle).

**Consolidated plan** (payment → entitlement → `writing.*` provisioning, legacy coexistence, API boundaries, implementation order): [`08-writing-shared-db-alignment.md`](./08-writing-shared-db-alignment.md).
