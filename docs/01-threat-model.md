# Threat Model: mirinae.jp Platform (Writing + Shared Commerce)

This document enumerates abuse scenarios per feature area and defines concrete prevention strategies. Client-submitted prices, user IDs, and privilege claims are never trusted. Commerce uses **`products`** (catalog), **`payment_orders`** (Stripe), and **`entitlements`** (grants); writing domain rows are provisioned under **`writing.*`** only after a valid entitlement path.

---

## 1. Payment (Stripe Checkout / webhooks)

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Attacker POSTs a fake `amount` or `course_id` to create a checkout session and pays a lower amount while the app grants full course access. | Server resolves **product id / SKU** from allowlist; loads **`products`** row; creates **`payment_orders`** with amounts **matching** the catalog (DB trigger enforces). Fixed writing SKU: `writing_course_10_sessions` with ¥2,180 × 10, subtotal ¥21,800, total ¥23,980 (10% tax). No client-supplied prices. |
| 2 | Attacker forges a webhook payload to mark a payment as succeeded without paying Stripe. | Verify `Stripe-Signature` on every webhook using the endpoint’s webhook signing secret. Reject unsigned or invalid signatures. Process only known event types (`checkout.session.completed`, etc.). |
| 3 | Same successful payment replayed: webhook delivered twice or attacker replays captured body + signature within validity window. | Idempotency: store `stripe_event_id` (unique) and/or `payment_intent_id` / `checkout_session_id` on **`payment_orders`**; skip processing if already recorded. Tie **`entitlements`** and **`writing.courses`** creation to first successful processing only. |
| 4 | Webhook processed in test mode against production DB or vice versa. | Separate Stripe keys and webhook secrets per environment; env vars `STRIPE_SECRET_KEY_TEST` / `LIVE`, `STRIPE_WEBHOOK_SECRET_TEST` / `LIVE`. Reject events where `livemode` does not match deployment mode. |
| 5 | User manipulates success/cancel URLs to land on completion page without payment. | Completion page and APIs that activate access require server-side proof: Stripe session status or rows created only by verified webhook—not query params alone. |

---

## 2. Authentication & session

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Client sends `userId` or `role` in JSON to impersonate another user. | Never accept `userId` from the client. Resolve identity only from signed HTTP-only session cookie / server-side session store. |
| 2 | Session fixation or stolen cookie used to access another account. | Secure, `HttpOnly`, `SameSite` cookies; rotate session ID on login; short session lifetime + sliding refresh as policy; HTTPS only. |
| 3 | Teacher APIs called with a student session to read queue or publish corrections. | Every mutating and sensitive read checks `role` (or capability) from session loaded server-side; deny by default. |

---

## 3. Password reset

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Enumeration: attacker learns which emails exist from different API responses. | Single generic response for “request reset” regardless of whether the account exists. |
| 2 | Token reuse or long-lived token used after legitimate reset. | One-time token stored hashed; invalidate on use; **15-minute** expiry; clear messaging in logs only. |
| 3 | Token brute force or predictable tokens. | Cryptographically random token (e.g. 32+ bytes); rate limit reset requests per IP and per email. |

---

## 4. OAuth

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | CSRF on OAuth start: attacker logs victim into attacker’s IdP account. | Validate `state` parameter (signed or server-stored nonce); one-time use. |
| 2 | Open redirect after OAuth steals `code`. | **Whitelist** allowed `redirect_uri` values; no arbitrary URLs from client. |
| 3 | Stale access token used after user revokes app. | Handle token refresh failures; verify logout invalidates server session; re-verify critical actions if needed. |

---

## 5. Course purchase & course lifecycle

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | User creates multiple `writing.courses` without paying by replaying client calls. | Create **`entitlements`** and **`writing.courses`** only from verified **`payment_orders`** / webhook path (idempotency), not from arbitrary client POST. |
| 2 | User sets `start_date` or `interval` to unlock all 10 sessions immediately. | Server validates `start_date` (within allowed bounds if any) and `interval` against **enum whitelist** (1d, 2d, 3d, 1w, 10d, 2w). Server computes all session schedule dates. |
| 3 | User edits course after creation to change schedule or session count. | Immutable schedule fields after creation, or teacher/admin-only updates with audit; students cannot PATCH course. |

---

## 6. Sessions & assignment unlock

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Student submits for session 5 before unlock time by sending `session_index=5`. | Server checks `sessions.unlock_at <= now()` and that the session belongs to the user’s course; reject otherwise. |
| 2 | Student opens two “active” submissions by racing parallel requests. | Partial unique index on **`user_id`** (active statuses): **at most one** in-flight submission **across all writing**; see [`04-decisions-and-policies.md`](./04-decisions-and-policies.md). |
| 3 | Student submits to another user’s course by guessing `course_id`. | All queries scoped by `user_id` from session; verify `course.user_id = session.user_id`. |

---

## 7. Submission (text / image)

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Student edits submission after “submit” by PATCHing content. | Transition to immutable state after submit; server rejects content updates unless admin correction workflow allows teacher-only edits on correction artifacts, not raw student text. |
| 2 | Multiple submissions per session after correction to farm feedback. | Business rule: next submission only after prior correction **completed**; enforce in DB + API. |
| 3 | Huge payload or malicious file DoS. | Max body size on API; for images: max file size, allowed extensions + **MIME sniff** validation, dimension limits if applicable. |

---

## 8. File upload (images)

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Executable uploaded with `.jpg` extension. | Allowlist extensions; verify MIME from file header; reject mismatch; scan or strip EXIF if policy requires. |
| 2 | Direct URL to uploaded file guesses other users’ objects. | Opaque object IDs; **storage outside web root**; access via signed URLs or authenticated proxy; paths never guessable from sequential IDs alone if possible. |
| 3 | Storage flooding. | Per-user and global quotas; rate limits on upload endpoint. |

---

## 9. Teacher dashboard & correction editor

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Student opens teacher queue or another student’s submission. | Role check `teacher` (or `admin`); list/query filters by authorization; submission fetch verifies assignment to a queue the teacher may access (policy: all teachers vs assigned—document and enforce). |
| 2 | Teacher modifies correction after student viewed it without audit. | Optional: `published_at` immutable snapshot; edits create new version or restricted post-publish policy. |
| 3 | Teacher assigns arbitrary scores to harm reputation. | Evaluation bounds 0–100 server-side; optional secondary review workflow (out of scope unless product adds it). |

---

## 10. Fragments (inline corrections)

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Fragments stored with offsets that point outside student text to inject XSS in viewers. | Sanitize display; validate offsets against stored plain text length; store **category enum** server-side only from allowlist. |
| 2 | Client forges fragments without teacher role. | Create/update fragment endpoints require teacher role + ownership of parent correction; student read-only. |
| 3 | Duplicate fragments bypassing “one correction” semantics. | Unique constraints or server merge rules per `(correction_id, fragment_order)` as needed. |

---

## 11. Evaluation & student result view

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Student PATCHes `grammar_accuracy` to 100. | Evaluations written only by teacher APIs; students read-only. Nullable scores allowed only until publish; DB trigger blocks publish without all scores. |
| 2 | Student sees another student’s results via IDOR. | Fetch by `submission_id` only if `submission.user_id = session.user_id` (students); teachers by role. |
| 3 | Explanations or AI text injected against product rules. | API returns only allowed fields: inline correction, polished sentence, model answer, short teacher comment; no free-form “explanation” field for student UI. |
| 4 | Student reads **draft** correction or fragments before teacher publishes. | Student APIs **must** filter `correction_status = published` (and RLS if direct DB access); DB stores `correction_status` + publish triggers. |
| 5 | Student guesses `correction_id` / API path to draft content. | Same as 4; authorize by role + correction visibility; reject draft for student role. |

---

## 12. My Page (stats & history)

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | User requests aggregated stats for `user_id` query param. | Ignore client user id; aggregate only for `session.user_id`. |
| 2 | Scraping frequent mistakes across all users. | Rate limit; data is per-user only; no public aggregate of other users’ mistakes unless explicitly anonymized global stat with strict access control. |
| 3 | “Global average” manipulated in client. | Compute global average on server; client displays server value only. |

---

## 13. Stripe client-facing flows

| # | Abuse scenario | Prevention |
|---|----------------|------------|
| 1 | Malicious site embeds your success URL in iframe to confuse users. | `X-Frame-Options` / CSP `frame-ancestors`; same-site cookies. |
| 2 | checkout.session.create called without auth to spam Stripe. | Require authenticated user (or explicit guest flow with CAPTCHA/rate limits if product allows). |
| 3 | Currency or line items altered in Stripe Dashboard by mistake. | Webhook handler re-validates `amount_total` against `TOTAL_JPY` (or equivalent minor units) before entitling; alert on mismatch. |

---

## Cross-cutting controls

- **Authorization boundary**: Every route declares required role; resource IDs always resolved with `user_id` / role from session.
- **Input validation**: Whitelists for enums (interval, error category, submission state); numeric ranges for scores.
- **Audit**: Log security-relevant events (payment applied, correction published) with correlation IDs; no secrets in logs.
- **Rate limiting**: Auth, reset, upload, checkout creation, webhook (per IP with care—Stripe uses fixed IPs; prefer application-level idempotency).

---

## Feature → abuse coverage matrix (minimum 3 scenarios each)

For compliance with the product requirement “for EVERY feature: 3 abuse scenarios + prevention,” the tables above map as follows:

| Feature | Section(s) |
|---------|----------------|
| Payment / Stripe | §1, §13 |
| Auth & session | §2 |
| Password reset | §3 |
| OAuth | §4 |
| Course & schedule | §5, §6 |
| Submissions | §7 |
| File upload | §8 |
| Teacher dashboard & correction | §9 |
| Fragments | §10 |
| Evaluation & results | §11 |
| My Page | §12 |

Each section lists **at least three** distinct abuse scenarios with matching prevention strategies.
