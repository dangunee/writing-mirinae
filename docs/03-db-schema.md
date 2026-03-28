# Database Schema: mirinae.jp Platform + Writing App

**Shared Supabase / quiz alignment:** [`05-integration-assessment.md`](./05-integration-assessment.md) — baseline DDL in-repo still references a custom `public.users` model for historical reference; **production** must use **`auth.users`**-only deltas per [`08-writing-shared-db-alignment.md`](./08-writing-shared-db-alignment.md) (migration plan + API boundaries).

**Behavioral decisions** (visibility, active submission rule, evaluations, roles, DB access) are in [`04-decisions-and-policies.md`](./04-decisions-and-policies.md).

Implementation: `supabase/migrations/20260327120000_platform_and_writing_schema.sql`, `db/schema.ts`.

---

## Enums

| Enum | Values |
|------|--------|
| `user_role` | `student`, `teacher`, `admin` |
| `platform_app` | `writing`, `quiz`, `ondoku` |
| `entitlement_status` | `active`, `revoked`, `expired`, `pending` |
| `course_status` | `pending_setup`, `active`, `completed`, `cancelled` |
| `session_status` | `locked`, `unlocked`, `completed` |
| `submission_status` | `draft`, `submitted`, `in_review`, `corrected`, `published` |
| `correction_status` | `draft`, `published` |
| `course_interval` | `interval_1d` … `interval_2w` |
| `error_category` | grammar … honorifics |
| `payment_status` | `pending`, `succeeded`, `failed`, `refunded` |

---

## Platform tables (`public`)

### `users`, `oauth_accounts`, `password_reset_tokens`

Shared identity — one account for all apps. See platform migration.

### `products`, `payment_orders`, `entitlements`, `stripe_webhook_events`

As before: catalog, Stripe orders with amount validation trigger, entitlements per payment, webhook idempotency.

---

## Writing schema (`writing`)

### `writing.courses`

| Column | Notes |
|--------|--------|
| `status` | `course_status`; default `pending_setup` until schedule is set |
| `start_date`, `interval` | Nullable while `pending_setup`; required when `active` / `completed` (CHECK) |
| `session_count` | Always `10` (CHECK) |
| `entitlement_id` | UNIQUE; purchase path |

### `writing.sessions`

| Column | Notes |
|--------|--------|
| `status` | `session_status`; default `locked`; `completed` after correction publish (trigger) |
| `unlock_at` | Schedule gate |

### `writing.submissions`

- **`UNIQUE (session_id)`** — one submission row per session slot.
- **Partial unique index** `writing_submissions_one_active_pipeline_per_user` on **`(user_id)`** where status ∈ (`draft`,`submitted`,`in_review`,`corrected`) — **one in-flight submission per user across all writing** (see decisions doc).
- **Triggers:** `fn_submissions_sync_course_and_owner`, `fn_submissions_prevent_content_after_submit`.

### `writing.corrections`

- **`status`** `correction_status`: **`draft`** = student APIs must not return; **`published`** = visible.
- **CHECK:** `(draft AND published_at IS NULL) OR (published AND published_at NOT NULL)`.
- **Triggers:** `fn_corrections_before_publish_validate` (scores required to publish), `fn_corrections_after_publish_sync` (submission + session sync).

### `writing.fragments`

Unchanged shape; visibility follows parent correction (API filters `status = published`).

### `writing.evaluations`

- **Nullable** score columns; **0–100** when set.
- **Publish** blocked until all three scores present (correction trigger).

---

## Relationship diagram (textual)

```
users 1───* payment_orders ─── entitlements 1───0..1 writing.courses
writing.courses 1───* writing.sessions 1───0..1 writing.submissions
writing.submissions 1───0..1 writing.corrections 1───* writing.fragments
writing.submissions 1───0..1 writing.evaluations
```

---

## Seed

Writing product `writing_course_10_sessions` (`ON CONFLICT (sku) DO NOTHING`).

---

## Summary of critical constraints

| Rule | Enforcement |
|------|-------------|
| Catalog vs order amounts | `payment_orders` trigger |
| Student-visible correction | `correction_status = published` + API |
| Publish without scores | `fn_corrections_before_publish_validate` |
| One active submission | Partial unique on `user_id` |
| Immutable submission body | Trigger after `draft` |
