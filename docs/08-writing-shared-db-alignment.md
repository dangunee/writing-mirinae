# Writing implementation plan — shared mirinae.jp platform database

This document **aligns** the writing product with the **shared Supabase/Postgres** used by mirinae.jp (quiz, admin, legacy writing surfaces). It is the authoritative plan for **delta migrations**, **data flows**, and **backend API boundaries**.

**Principles**

| Rule | Detail |
|------|--------|
| **Identity** | **`auth.users(id)`** is the **only** user identity for FKs. **Do not** create **`public.users`**. |
| **Auth features** | Use **Supabase Auth** (OAuth, password reset, sessions) — not parallel tables in `public`. |
| **Newsletter** | Schema **`newsletter`** stays **as deployed**; no changes required for writing alignment. |
| **Quiz / public apps** | Coexist per [`07-platform-scope.md`](./07-platform-scope.md). |
| **Baseline file in repo** | `20260327120000_platform_and_writing_schema.sql` is a **logical reference**; **shared DB** should receive **`auth.users`-aligned deltas** only (see §3). Do not apply the baseline wholesale if it creates **`public.users`**. |

---

## 1. End-to-end flow: payment → entitlement → writing domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Checkout creation (server)                                                │
│    Authenticated user = auth.users.id from JWT/session                      │
│    Load products row (fixed SKU); INSERT payment_orders (amounts = catalog)  │
│    Stripe Checkout Session with metadata: payment_order_id, auth user id     │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. User pays on Stripe                                                       │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Webhook (server, raw body)                                                │
│    Verify signature; idempotency via stripe_event_id / session id             │
│    Set payment_orders.status = succeeded, paid_at                             │
│    INSERT entitlements (app = writing, status = active, user_id = buyer)    │
│    OPTIONAL: sync customer_profiles (e.g. mirror “有” / course_type) — policy  │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Writing provisioning (server, same transaction or job after entitlement) │
│    INSERT writing.courses (user_id, entitlement_id, status = pending_setup)   │
│    On student submit of schedule: set start_date, interval, status = active   │
│    INSERT 10 × writing.sessions (unlock_at computed, status = locked/…)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Rules**

- **`writing.courses.entitlement_id`** is **1:1** with the purchase; one course per successful writing product entitlement.
- **`writing.courses.user_id`** must equal **`entitlements.user_id`** (DB trigger in reference baseline enforces).
- **Schedule**: student (or onboarding UI) sets **`start_date`** + **`interval`**; server generates **`writing.sessions`** rows **1..10** with **`unlock_at`** — never trust client-only dates without server validation.

---

## 2. Legacy writing-related tables (quiz-mirinae / shared DB)

These **already exist** on many deployments and use **`auth.users`**:

| Object | Purpose (legacy) |
|--------|-------------------|
| **`essay_submissions`** | Period/item-based 作文提出; status feedback flow |
| **`writing_visibility`**, **`writing_visibility_student`** | Per period/item visibility dates |
| **`customer_profiles`** | Plan, payment_status, course_type, writing_approved, etc. |

### Coexistence strategy (recommended default)

| Approach | Detail |
|----------|--------|
| **Parallel operation** | New paid flow uses **`writing.*`** + **`entitlements`**. Legacy tables **unchanged** for existing students until migrated. |
| **No FK** between **`essay_submissions`** and **`writing.submissions`** | Different product shapes; link only in application layer if ever needed (e.g. same `auth.users` id). |
| **`customer_profiles`** | **Optional mirror**: after entitlement activation or webhook, API may **UPDATE** `customer_profiles` for ops/dashboard consistency (e.g. course_type, payment flags). **Not** the source of truth for Stripe — **`payment_orders` + `entitlements`** are. |
| **Migration (future)** | Batch or per-user migration from period/item model → course/session model is a **separate project** with cutover criteria. |

### Deprecation

- Mark legacy APIs/UI as **legacy** in runbooks; do not drop tables without backup and product sign-off.

---

## 3. Migration / update plan (shared DB)

**Goal:** Add platform + writing objects **without** `public.users`, with **`auth.users`** FKs, coexisting with quiz structures.

### Phase A — Preconditions

1. List existing types/tables on staging: `products`, `payment_orders`, `writing`, enums — avoid name collisions.
2. Confirm **`newsletter`** migration already applied or apply [`20260328120000_newsletter_schema.sql`](../supabase/migrations/20260328120000_newsletter_schema.sql) independently.

### Phase B — Delta SQL (new file, e.g. `YYYYMMDD_writing_platform_auth_users.sql`)

Suggested contents (single migration or split by dependency order):

1. **`CREATE EXTENSION IF NOT EXISTS citext`** (if missing).
2. **Enums** — use prefixed or unique names if `user_role` / `payment_status` already exist in `public`; otherwise `CREATE TYPE` as designed.
3. **`products`** + seed row for `writing_course_10_sessions` (`ON CONFLICT (sku) DO NOTHING`).
4. **`payment_orders`** with **`user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`** + catalog validation trigger.
5. **`entitlements`** with **`user_id` → `auth.users`** + triggers.
6. **`stripe_webhook_events`** (if not present).
7. **`CREATE SCHEMA IF NOT EXISTS writing`** + all **`writing.*`** tables with **`user_id` → `auth.users`** + triggers (sync course, immutable submission, correction publish, etc.).

**Omit from delta:** `CREATE TABLE users`, `oauth_accounts`, `password_reset_tokens`.

### Phase C — Drizzle / app layer

- Point **`users`** concept at **`auth.users`** via Supabase client or a thin **`public.profiles`** view/table **only if** you need email mirror — optional.
- Update **`db/schema.ts`** (or split modules) so platform tables reference **`authUsers`** stub (`auth.users`) like **`newsletter-schema.ts`**, not **`public.users`**.

### Phase D — Data backfill (if any test rows used wrong FK)

- N/A for greenfield; production runbook only if mistakes occur.

---

## 4. Backend API boundaries

All endpoints use **server session / JWT** → **`auth.users.id`**. Never accept raw `user_id` from client for authorization.

### 4.1 Checkout creation

| Responsibility | Detail |
|----------------|--------|
| **Auth** | Require logged-in user; resolve `buyer_id = auth.users.id`. |
| **Input** | Product id or **SKU** allowlist (`writing_course_10_sessions`); optional success/cancel URLs (allowlisted origins). |
| **Forbidden** | Client-supplied prices, totals, tax. |
| **Actions** | Load **`products`**; **`INSERT payment_orders`** with snapshot = catalog; create Stripe Checkout Session; store `stripe_checkout_session_id` on order; return Stripe URL. |
| **Out of scope** | Entitlement creation here (wait for payment success). |

### 4.2 Webhook processing

| Responsibility | Detail |
|----------------|--------|
| **Transport** | `POST` Stripe webhook; **raw body** for signature verification. |
| **Idempotency** | Insert **`stripe_webhook_events`** or use unique **`payment_orders.stripe_event_id`**; skip duplicates. |
| **Validation** | Match `amount_total` / currency to expected **`products.total_jpy`** for the line item. |
| **Actions** | Update **`payment_orders`** → succeeded; **`INSERT entitlements`** (`active`, `app = writing`); enqueue or inline **provisioning** (§4.4). |
| **Out of scope** | Sending email; full UI. |

### 4.3 Entitlement granting

| Responsibility | Detail |
|----------------|--------|
| **Trigger** | Successful payment (webhook) or reconciling Stripe API if webhook delayed. |
| **Actions** | Single **`entitlements`** row per **`payment_order_id`**; set **`status = active`**, **`valid_from`** if policy requires. |
| **Idempotent** | Unique **`payment_order_id`** on entitlements. |
| **Next** | Call **course provisioning** once per new writing entitlement. |

### 4.4 Writing course / session provisioning

| Responsibility | Detail |
|----------------|--------|
| **Trigger** | New **`entitlements`** row with **`app = writing`** and **`status = active`**. |
| **Actions** | **`INSERT writing.courses`** (`user_id`, `entitlement_id`, `pending_setup`, `session_count = 10`). **Do not** create **`writing.sessions`** until **`start_date`** + **`interval`** are set (student onboarding). |
| **Schedule API** | Student submits schedule → validate interval enum + dates → **`UPDATE writing.courses`**, **`INSERT` 10 sessions** with **`unlock_at`**. |
| **Out of scope** | Teacher assignment to course (future). |

### 4.5 Student submission flow

| Responsibility | Detail |
|----------------|--------|
| **Auth** | Student = **`auth.users.id`** = **`writing.courses.user_id`**. |
| **Read** | List courses/sessions/submissions for **self only**; corrections **`status = published`** only. |
| **Write** | Create/update submission in **`draft`**; submit → immutable; respect **one active submission per user** (partial index). |
| **Out of scope** | Client-side pricing. |

### 4.6 Teacher correction flow

| Responsibility | Detail |
|----------------|--------|
| **Auth** | Teacher/admin via **`ADMIN_SECRET`** and/or future **`auth.users` + role table**; enforce in middleware. |
| **Read** | Queue: submissions awaiting review; full correction in **`draft`**. |
| **Write** | Upsert **`writing.corrections`**, **`fragments`**, **`evaluations`**; publish only when scores complete (DB trigger). |
| **Out of scope** | AI generation. |

---

## 5. Backend implementation order

Suggested build sequence for the **backend** (no UI in this phase):

| Order | Deliverable |
|-------|-------------|
| **1** | **Delta migration** applied on staging: `auth.users` FKs, no `public.users`. |
| **2** | **DB access layer** (Drizzle/SQL) aligned with delta + **`authUsers`**. |
| **3** | **Checkout session API** + Stripe client (test mode). |
| **4** | **Webhook handler** + idempotency + entitlement insert + **provision `writing.courses`**. |
| **5** | **Schedule API** → generate **`writing.sessions`**. |
| **6** | **Student APIs**: submissions, immutable submit, published-only reads. |
| **7** | **Teacher APIs**: queue, correction CRUD, publish. |
| **8** | **Optional** `customer_profiles` sync hook after entitlement. |
| **9** | **Monitoring**: failed webhooks, mismatched amounts. |

---

## 6. Related documents

| Doc | Role |
|-----|------|
| [`05-integration-assessment.md`](./05-integration-assessment.md) | Conflict analysis vs quiz-mirinae |
| [`07-platform-scope.md`](./07-platform-scope.md) | Paid vs public app scope |
| [`04-decisions-and-policies.md`](./04-decisions-and-policies.md) | Writing behavior (visibility, submissions, evaluations) |
| [`06-newsletter-schema.md`](./06-newsletter-schema.md) | Newsletter (unchanged) |
| [`09-payment-to-course-backend.md`](./09-payment-to-course-backend.md) | **Code-level** payment → webhook → entitlement → course → sessions (APIs, transactions, idempotency, TS reference) |
