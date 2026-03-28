# Platform Decisions & Policies (Writing v1)

This document records **final rules** refined before backend API implementation. It complements `03-db-schema.md` and `02-architecture.md`.

---

## 1. Status enums

| Enum | Values | Use |
|------|--------|-----|
| **`course_status`** | `pending_setup`, `active`, `completed`, `cancelled` | Writing course lifecycle after entitlement provisioning. `pending_setup` until the student sets schedule (then `active` with sessions generated). |
| **`session_status`** | `locked`, `unlocked`, `completed` | Each of 10 session slots. `locked` until `unlock_at`; `unlocked` when the student may work; `completed` when the correction is **published** (DB trigger syncs). |
| **`correction_status`** | `draft`, `published` | Teacher-facing vs student-visible. **`draft`** = internal only; **`published`** = student APIs may return the correction (with `published_at` set). |

**`submission_status`** (existing) remains: `draft` → `submitted` → `in_review` → `corrected` → `published`. **`submission.published`** aligns with released result; set together with **`correction_status = published`** via trigger.

---

## 2. Submission / result visibility

| Layer | Rule |
|-------|------|
| **Database** | `writing.corrections.status` must be `published` for a non-null `published_at`. CHECK enforces draft ↔ published_at pairing. |
| **Publish gate** | Trigger **`fn_corrections_before_publish_validate`**: cannot set `published` unless all three evaluation scores are non-null. |
| **Sync** | Trigger **`fn_corrections_after_publish_sync`**: sets `writing.submissions.status = published` and `writing.sessions.status = completed`. |
| **API (required)** | Student-facing list/detail endpoints **must** filter `WHERE corrections.status = 'published'` (and never expose fragments/correction body for `draft`). |
| **RLS (if used)** | If Supabase client ever reads Postgres directly, policies must mirror the same predicate (see §6). |

Students **never** read draft corrections; DB + API enforce together.

---

## 3. One active submission (final rule)

**Decision: stricter — one in-flight submission per user across all writing courses** (platform-wide in `writing.*`).

- **Partial unique index** on `writing.submissions (user_id)` where `status IN ('draft','submitted','in_review','corrected')`.
- **Rationale:** Matches “only one assignment in progress at a time” for a student; prevents parallel drafts across multiple purchased courses. If the business later allows parallel courses, relax to **per `course_id`** (replace index column).

`published` rows are excluded from the index, so a student can have many completed sessions and only one active pipeline.

---

## 4. Evaluations

- **Columns** `grammar_accuracy`, `vocabulary_usage`, `contextual_fluency` are **nullable** while the teacher is drafting.
- **CHECK** (when non-null): each score in **0–100**.
- **Publish:** trigger requires **all three non-null** before `correction_status` can become `published`.

---

## 5. Role model

### Current (global)

- **`users.role`**: `student` | `teacher` | `admin` — platform-wide, single column today.
- **Authorization:** APIs must enforce **teacher** routes for correction queue/editor/publish; **student** routes for own submissions and **published** corrections only.

### Future (app-specific teacher/admin)

- **Plan:** add a separate table or JSON policy, e.g. `user_app_roles (user_id, app, role)` or `writing_teacher_allowlist`, without overloading `users.role` for per-app nuance.
- **Writing teacher** may later be restricted to a subset of users; **quiz** / **ondoku** admin roles would use separate rows or schemas.
- **Do not** change `users.role` semantics in this migration; document extension only.

---

## 6. Database access policy

### Default (chosen for v1)

- **Browsers do not talk to Postgres directly.** All reads/writes go through **backend APIs** (or serverless functions) using a **server-side DB connection** with pooled credentials.
- **No Supabase anon key** in the client for writing data in production.

### If Supabase client / direct DB access is introduced later

- **RLS required** on at least:
  - `writing.submissions` — student: `user_id = auth.uid()`; teacher: policy for queue as designed.
  - `writing.corrections` — student: `status = 'published'` AND submission ownership chain; teacher: full access to assigned/global scope.
  - `writing.fragments` — join through corrections with same visibility rules.
  - `writing.evaluations` — student read-only; teacher write.
- **Never** rely on RLS alone for Stripe or catalog price logic — **server** remains authoritative for checkout and webhooks.

---

## 7. Unpublish / rollback

- **Correction unpublish** (draft after published) is **not** supported in v1; the AFTER trigger does not revert submission/session. If added later, implement explicit compensating updates in the API.

---

## 8. Related files

- Migration: `supabase/migrations/20260327120000_platform_and_writing_schema.sql`
- Drizzle: `db/schema.ts`
