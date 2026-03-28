# Payment → course backend flow (shared mirinae.jp platform)

**Stack:** Vercel (API routes / serverless), Supabase Postgres (access only via **service role** from server in v1), Stripe (Checkout + webhooks).

**Rules:** Identity = **`auth.users(id)`** only; **no `public.users`**; **browser never talks to Postgres**; **Stripe webhook is the only source of truth** for payment completion; **newsletter** schema unchanged; **writing** is the first paid app on this model.

---

## 0. Entity relationships (how rows connect)

```
auth.users(id)
    ↑
payment_orders.user_id ──1──1── entitlements.payment_order_id (UNIQUE)
    │                              ↑
    │                              └── entitlements.user_id → auth.users
    │
    └── products.id (catalog snapshot on order row)

entitlements(id) ──1──1── writing.courses.entitlement_id (UNIQUE)
                         writing.courses.user_id → auth.users (must match entitlement.user_id; DB trigger)

writing.courses(id) ──1──*── writing.sessions (10 rows, index 1..10)
```

- **One** `payment_orders` row per Checkout Session attempt (or per completed payment path — product decision: typically one order row created at session creation, updated on webhook).
- **One** `entitlements` row per succeeded **`payment_order`** (`payment_order_id` UNIQUE).
- **One** `writing.courses` row per **writing** entitlement (`entitlement_id` UNIQUE).
- **`writing.courses.status`:** `pending_setup` until schedule is applied; **`active`** once `start_date` + `interval` are set and **10 sessions** exist.

---

## 1. Checkout creation

### Purpose

Create a **server-owned** `payment_orders` row and a **Stripe Checkout Session**; return **only** the Stripe URL to the browser.

### API

| Field | Value |
|-------|--------|
| **Route** | `POST /api/writing/checkout` (or `/api/platform/checkout` if shared) |
| **Auth** | Required: Supabase session / JWT → **`buyerId = auth.users.id`** (validated server-side). |
| **Content-Type** | `application/json` |

### Input (allowed)

| Field | Type | Notes |
|-------|------|--------|
| `productSku` | `string` | **Optional** if single product; must be allowlisted, e.g. `writing_course_10_sessions`. |
| `successUrl` | `string` | Optional; must match **allowlist** (exact prefix or hostname env). |
| `cancelUrl` | `string` | Same. |

### Input (**forbidden** — reject 400)

| Field | Reason |
|-------|--------|
| `price`, `amount`, `total`, `currency` from client | Never trusted; all amounts from **`products`**. |
| `userId`, `email` for identity | Identity **only** from auth session. |

### Output (200)

```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "paymentOrderId": "uuid"
}
```

### Security checks

1. Session present and **`auth.users.id`** resolvable.
2. **`products`** row loaded **by SKU** (or fixed UUID); `active = true`.
3. **`INSERT payment_orders`:** copy **all** monetary fields from **`products`**; trigger `payment_orders_validate_catalog_match` must pass.
4. Stripe metadata: `{ payment_order_id, supabase_user_id: <auth.users.id> }` for reconciliation (never trust metadata alone for money).
5. **Rate limit** per user / IP for checkout creation.

### Transaction boundary

- **Option A (recommended):** Single DB transaction: `INSERT payment_orders` → commit → call Stripe API. If Stripe fails, **mark order `failed`** or delete orphan (policy).
- **Option B:** Insert order `pending`, call Stripe; on failure update order `failed`.

### Idempotency (checkout)

- Not required for first version; optional **client-provided idempotency key** stored on `payment_orders.metadata` to avoid double sessions from double-clicks.

---

## 2. Stripe webhook handling

### Purpose

**Only path** that marks payment succeeded and creates **`entitlements` + `writing.courses`**.

### API

| Field | Value |
|-------|--------|
| **Route** | `POST /api/webhooks/stripe` |
| **Auth** | **None** from user; **`Stripe-Signature`** verification only. |
| **Body** | **Raw** bytes (critical for signature). |

### Handler steps

1. **Verify** `constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)` — wrong signature → **401**.
2. **Idempotency:** If `event.id` already in **`stripe_webhook_events`** (or `payment_orders.stripe_event_id` set) → **return 200** immediately (no duplicate side effects).
3. **Filter** event types: at minimum `checkout.session.completed` (and optionally `payment_intent.succeeded` if you link PI id).
4. **Load** Checkout Session from event; read `metadata.payment_order_id` and **`amount_total`** / **`currency`**.
5. **Validate money:** `amount_total` must equal **expected minor units** for **`products.total_jpy`** (JPY: yen integer).
6. **Transaction (single):**
   - `INSERT stripe_webhook_events` (or rely on unique `stripe_event_id` on `payment_orders` if you store there first).
   - `UPDATE payment_orders SET status = 'succeeded', paid_at = now(), stripe_event_id = ?, stripe_payment_intent_id = ? WHERE id = ?`
   - `INSERT entitlements` (`user_id` from **payment_orders.user_id**, `product_id`, `payment_order_id`, `app = 'writing'`, `status = 'active'`)
   - `INSERT writing.courses` (`user_id`, `entitlement_id`, `status = 'pending_setup'`, `session_count = 10`, `start_date`/`interval` **NULL**)
7. **Commit.**

### Forbidden

- Creating entitlement from **success redirect page** without webhook (redirect may be spoofed or arrive before webhook — use **read-only** “processing” UI).
- Trusting **client** POST to “confirm payment”.

### Security checks

- Webhook secret from env (**live** vs **test** matches Stripe mode).
- **`payment_orders.user_id`** must match metadata `supabase_user_id` if present (defense in depth).
- **Concurrency:** `SELECT ... FOR UPDATE` on `payment_orders` if two webhooks race (rare).

### Idempotency (webhook)

| Mechanism | Role |
|-----------|------|
| **`stripe_event_id` UNIQUE** | Reject duplicate processing. |
| **`stripe_webhook_events`** table | Audit + fast duplicate check. |
| **`entitlements.payment_order_id` UNIQUE** | Second processing of same order cannot insert second entitlement. |

Return **200** for idempotent replays so Stripe stops retrying.

---

## 3. Entitlement creation

### When

Inside the **same DB transaction** as `payment_orders` success update (see §2).

### Row shape

- `user_id` = **`payment_orders.user_id`** (must equal **`auth.users`** who checked out).
- `product_id` = **`payment_orders.product_id`**.
- `payment_order_id` = FK **UNIQUE**.
- `app` = `'writing'` (must match `products.app` — trigger).

### Forbidden

- Creating entitlement without succeeded **`payment_orders`**.
- **Client** calling “grant entitlement” API without webhook (no such public API in v1).

---

## 4. `writing.courses` creation

### When

Immediately after **`entitlements`** insert for **writing** product (**same transaction** as webhook).

### Row shape

- `user_id` = **`entitlements.user_id`**
- `entitlement_id` = **`entitlements.id`**
- `status` = **`pending_setup`**
- `session_count` = **10**
- `start_date`, `interval` = **NULL**

### State: `pending_setup` vs `active`

| Status | Meaning |
|--------|---------|
| **`pending_setup`** | Paid; course shell exists; **no `writing.sessions` rows yet** (or policy: empty schedule). |
| **`active`** | Student submitted **valid** `start_date` + **`interval`**; **10 sessions** inserted; course is in progress. |

**Transition:** Only via **schedule API** (§5): `pending_setup` → **`active`** after validation + session generation.

### Security

- DB trigger **`writing_courses_entitlement_user`** ensures `courses.user_id` = `entitlements.user_id`.

---

## 5. Writing session provisioning (after schedule selection)

### API

| Field | Value |
|-------|--------|
| **Route** | `POST /api/writing/courses/:courseId/schedule` (or `PATCH` course) |
| **Auth** | Required; **`auth.users.id` === `writing.courses.user_id`**. |

### Input (allowed)

| Field | Type | Notes |
|-------|------|--------|
| `startDate` | `string` (ISO date) | Server parses in **fixed TZ** (e.g. `Asia/Tokyo`). |
| `interval` | enum | Must match DB **`course_interval`** allowlist. |

### Input (forbidden)

| Field | Reason |
|-------|--------|
| `sessionCount` | Fixed **10** server-side. |
| Arbitrary `unlockAt[]` | Server computes all **`unlock_at`**. |

### Behavior

1. Load **`writing.courses`** by id; verify **owner**; status must be **`pending_setup`** (or allow idempotent retry if already `active` → no-op / 409).
2. **Validate** `startDate` within product rules (e.g. not in distant past if policy says so).
3. **Transaction:**
   - `UPDATE writing.courses SET start_date, interval, status = 'active', updated_at = now()`
   - **Delete** any stray sessions if re-run (should be none) then **`INSERT` 10 rows** into **`writing.sessions`**:
     - `index` = 1..10
     - `unlock_at` = compute from `startDate` + `(index - 1) * intervalStep` (see algorithm below)
     - `status` = `locked` (first session may be `unlocked` if `unlock_at <= now()` — optional job or immediate update)
4. **Commit.**

### Unlock schedule algorithm (server-only)

Let **`stepMs`** = duration of one **`interval`** enum (1d, 2d, 3d, 1w, 10d, 2w).

For **`index` ∈ [1, 10]**:

```
unlock_at[index] = startOfDay(startDate, tz) + (index - 1) * stepMs
```

- Use **consistent timezone** (document in code).
- Session **1** unlocks at **course start**; session **k** unlocks after **(k-1)** intervals.

### Security

- **Authorization:** course **`user_id`** === session user only.
- **No** extra sessions beyond 10 (DB CHECK + application loop cap).

---

## 6. Transaction summary

| Operation | Transaction scope |
|-----------|-------------------|
| Checkout | Order insert (+ optional Stripe call ordering per §1). |
| Webhook | Webhook event record + order update + entitlement + **initial course row** — **one commit**. |
| Schedule | Course update + **10 session inserts** — **one commit**. |

---

## 7. Implementation order (backend)

1. **Delta migration** on staging: `auth.users` FKs; no `public.users`.
2. **Stripe client** + env (test mode).
3. **`POST /api/writing/checkout`** + `CheckoutService.createSession`.
4. **`POST /api/webhooks/stripe`** + `WebhookService.handle` + `FulfillmentService.fulfillWritingPurchase` (transaction).
5. **`POST .../schedule`** + `WritingScheduleService.provisionSessions`.
6. Observability: structured logs, alert on amount mismatch.

---

## 8. Migration adjustments before coding

- Ensure **delta** migration replaces **`REFERENCES users(id)`** with **`REFERENCES auth.users(id)`** for `payment_orders`, `entitlements`, `writing.courses`, `writing.submissions`, `writing.corrections` (teacher FK may remain **`auth.users`** for teachers).
- **No code** should assume **`public.users`** exists.

---

## 9. TypeScript service design

See **[`server/design/payment-to-course-flow.ts`](../server/design/payment-to-course-flow.ts)** for interfaces and function signatures (reference only; wire to Drizzle + Stripe in implementation).
