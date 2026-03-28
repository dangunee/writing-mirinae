# System Architecture: mirinae.jp Platform + Writing App

mirinae.jp is a **multi-app platform** (e.g. **`/writing`**, **`/quiz`**, **`/ondoku`**) with **one shared user account** and **shared commerce** (`products`, `payment_orders`, `entitlements`). The **writing** product is implemented first; domain data for writing lives in the PostgreSQL schema **`writing`** so **quiz** and **ondoku** can add their own schemas later without coupling to writing tables.

The **writing** UI stays integrated into the existing **mirinae.jp/writing/** route (Stitch preserved). This document covers platform boundaries, student/teacher flows, Stripe, lifecycles, and authorization.

**What is in scope for “shared platform” work:** paid foundations for **writing** and **future paid apps** (`auth.users`, commerce, entitlements, app schemas). **Public-read apps** (e.g. Q&A, dailylife) and **quiz**’s current shape are **not** required to move into that model yet — see [`07-platform-scope.md`](./07-platform-scope.md).

**Implementation plan for the shared DB** (payment → entitlement → `writing.*`, legacy coexistence, backend API boundaries, phased delivery): [`08-writing-shared-db-alignment.md`](./08-writing-shared-db-alignment.md).

**Detailed backend (checkout, webhook, fulfillment, schedule):** [`09-payment-to-course-backend.md`](./09-payment-to-course-backend.md) and [`server/design/payment-to-course-flow.ts`](../server/design/payment-to-course-flow.ts).

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (mirinae.jp — /writing, /quiz, /ondoku)                 │
│  Writing: Stitch UI on /writing/*                                │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (JSON, cookies, uploads)
┌────────────────────────────▼────────────────────────────────────┐
│  Platform backend (API + session)                              │
│  - Shared auth (single registration, session = user id)         │
│  - Catalog + Checkout Session + webhooks (all apps)              │
│  - Entitlements → provision app-specific rows                    │
│  - Writing: course/session/submission/correction orchestration   │
└─────────────┬───────────────────────────────┬─────────────────────┘
              │                               │
┌─────────────▼─────────────┐     ┌───────────▼───────────────┐
│  PostgreSQL                                              │
│  public: users, oauth, products, payment_orders,          │
│          entitlements, stripe_webhook_events              │
│  writing: courses, sessions, submissions, corrections,    │
│           fragments, evaluations                          │
│  (future: quiz.*, ondoku.* — no FK to writing.*)          │
└────────────────────────────┘     │  Object storage (writing uploads) │
                                   └──────────────────────────────────┘
              │
┌─────────────▼──────────────────────────────────────────────────┐
│  Stripe (hosted Checkout / Payment Element)                     │
│  Redirect; webhooks to backend; Dashboard for ops                 │
└──────────────────────────────────────────────────────────────────┘
```

**Frontend responsibilities**

- Render Stitch structure for `/writing` and nested views (payment entry, student assignment, result, My Page, teacher dashboard).
- Call backend APIs with credentials; **never** send `userId` or prices for entitlement.
- Display loading/error states; poll or subscribe for correction readiness if product requires (implementation detail).

**Backend responsibilities**

- Session management; resolve `user_id` and `role` from session only.
- All business rules: pricing, course creation, session unlock times, submission state machine, correction publish, evaluations, aggregates for My Page.
- Stripe: create Checkout Session with server-computed line items; verify webhooks; idempotent payment application.
- File ingestion: validate, store privately, return opaque references.

**Database responsibilities**

- **Platform**: one `users` row per person; `products` catalog per `app`; `payment_orders` with Stripe idempotency; `entitlements` as the grant that unlocks app-specific provisioning.
- **Writing**: `writing.*` tables only reference `users` and `entitlements` (via `writing.courses`), not raw payment rows.
- Store **subtotal** and **total** on `payment_orders` (and mirrored on `products` for catalog truth).

**Storage responsibilities**

- Binary objects keyed by internal ID; no public listing; access via signed URLs or authenticated download route.

---

## 2. Student flow (logical)

1. **Browse / pay** — User on writing payment UI clicks pay → backend creates Checkout Session (no client price) → redirect to Stripe.
2. **Return** — Stripe redirects to success URL → optional “completion / guide” page (content from Stitch); entitlement already applied via webhook (or verified session retrieve if synchronous path needed).
3. **Configure course** — User selects **start date** and **interval** (whitelist: 1d, 2d, 3d, 1w, 10d, 2w); server generates **10 sessions** with computed `unlock_at`.
4. **Assignment** — For current unlocked session, student starts work; **one active submission** rule enforced.
5. **Submit** — Text and/or image per product rules; on submit, content becomes **immutable**.
6. **Wait** — UI shows waiting state until correction exists in `published` state.
7. **View result** — Student sees only: inline correction, polished sentence, model answer, short teacher comment (no explanations); evaluations as scores.
8. **Next** — Next session’s submission allowed only after previous correction **completed** (and schedule allows).

Student routes remain under the **existing `/writing` route**; new functionality is **composed into** that page structure (no separate marketing site).

---

## 3. Teacher flow (logical)

1. **Auth** — Same app; teacher role from session.
2. **Dashboard layout** — Stitch: **left** queue grouped by date, **center** correction editor, **right** tools panel.
3. **Pick submission** — From queue; server returns only submissions the teacher may access (policy: global queue vs assignment—implement one and document).
4. **Edit** — Inline markup semantics: incorrect → red + strikethrough; corrected → bold + navy/green (presentation follows Stitch tokens).
5. **Fragments** — Auto-created from selection; editable; each fragment: `original_text`, `corrected_text`, `error_category` (enum).
6. **Evaluation** — Set Grammar Accuracy, Vocabulary Usage, Contextual Fluency (0–100 each).
7. **Publish** — Moves correction into student-visible state; student can then start next assignment per rules.

---

## 4. Stripe flow (platform)

1. **Client** — User clicks pay on the writing payment UI → `POST /api/checkout/sessions` with **product id or SKU** resolved server-side (e.g. `writing_course_10_sessions`), **no client price**.
2. **Server** — Loads **`products`** row; creates **`payment_orders`** row with amounts copied from catalog; creates Stripe Checkout Session; returns `url`.
3. **Redirect** — Browser redirects to Stripe-hosted UI.
4. **Webhook** — Verify signature; idempotent processing; set `payment_orders` to succeeded; create **`entitlements`** (`app = writing`); provision **`writing.courses`** + **`writing.sessions`** from entitlement.
5. **Success page** — Completion/guide under `/writing`; prefer webhook-first consistency.

**Security**: Ignore client price; validate Stripe totals against **`products`** / **`payment_orders`**; separate test/live keys and secrets.

---

## 5. Submission lifecycle

| State | Meaning |
|-------|---------|
| `draft` | Student editing; not yet submitted. |
| `submitted` | Immutable student content; awaiting teacher. |
| `in_review` | Optional; teacher claimed. |
| `corrected` | Teacher has work in progress; paired with **`correction_status = draft`**. |
| `published` | Student can view result; set when **`correction_status = published`** (DB trigger). |

**Course / session:** `course_status` and `session_status` track schedule and completion; see [`04-decisions-and-policies.md`](./04-decisions-and-policies.md).

**Rules**

- After `submitted`, student cannot edit body or attachments.
- **One active submission per user across all writing** (partial unique index on `user_id`); see decisions doc for rationale and how to relax if needed.
- Next session only after prior correction **published** (and schedule allows).

---

## 6. Correction publish lifecycle

1. Teacher creates/updates **Correction** with **`correction_status = draft`** (student APIs **must not** return drafts).
2. Teacher edits **Fragments** and **Evaluation** (scores nullable until ready).
3. Teacher sets polished sentence, model answer, short comment (1–2 lines).
4. **Publish** sets **`correction_status = published`** and `published_at`; trigger requires **all three evaluation scores** non-null; then syncs **submission** to `published` and **session** to `completed`.

**Authorization**: Only teacher (or admin) can create/update/publish corrections for submissions in their scope.

---

## 7. Authorization boundaries

| Actor | Can |
|-------|-----|
| **Anonymous** | Public marketing only if any; no submission or payment without auth (unless product explicitly allows guest checkout—default: auth required for checkout creation). |
| **Student** | Own courses, sessions, submissions, **only `correction_status = published`** views, My Page aggregates; create checkout session for self; upload to own submission. **Never** draft corrections or draft fragments. |
| **Teacher** | List assigned/global queue, read submissions, write corrections/fragments/evaluations, publish. |
| **Admin** | Overrides, refunds outside app, support tools (out of band). |

**Hard rules**

- `user_id` never from client JSON/query for authorization.
- Resource IDs always joined with `WHERE user_id = :session_user_id` for students.
- Teacher access: `role = teacher` + submission visibility rule.

---

## 8. My Page & aggregates

- **Correction rate per session**, **frequent mistakes**, **evaluation summary** (grammar, vocabulary, context), **instructor comments history**, **submission rate (e.g. 7/10 + global average)** — all computed **server-side**; client renders numbers returned by API.

---

## 9. Non-goals (explicit)

- No AI-generated explanations or content in the correction product surface.
- No trusting client for prices, scores, or user identity.
- No separate standalone product landing page; integration lives under **/writing**.

---

## 10. Deployment notes

- Separate **test** and **live** Stripe keys and webhook endpoints (or secrets) per environment.
- Webhook endpoint must use raw body for signature verification (framework-specific middleware order).

---

## 11. Database access policy (v1)

- **Default:** the browser does **not** connect to Postgres directly. All access goes through **backend APIs** (or server-side functions) with a **server-held** database URL / service role.
- **If** Supabase (or similar) client access from the browser is added later, **RLS** must enforce the same visibility rules as the API (especially **`writing.corrections.status = published`** for students). Catalog and Stripe remain server-authoritative in all cases.

Details: [`04-decisions-and-policies.md`](./04-decisions-and-policies.md) (§5–§6).
