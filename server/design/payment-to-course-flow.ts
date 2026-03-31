/**
 * Reference design: payment → entitlement → writing.courses → writing.sessions
 * Identity: auth.users(id) only. Wire to Drizzle + Stripe in real API routes.
 * Not invoked from browser DB — server-only, service role to Postgres.
 */

// --- Types (align with DB enums after auth.users delta migration) ---

import type { CourseInterval } from "../types/writing";

export type { CourseInterval };

export const WRITING_PRODUCT_SKU = "writing_course_10_sessions" as const;

/** Allowlisted SKUs for POST /api/writing/checkout (prices from DB only). */
export const WRITING_CHECKOUT_SKUS = [
  "writing_trial_lesson",
  "writing_1_session",
  "writing_5_sessions",
  "writing_10_sessions_promo",
  /** Legacy catalog row (may still exist in DB). */
  WRITING_PRODUCT_SKU,
] as const;

export type WritingCheckoutSku = (typeof WRITING_CHECKOUT_SKUS)[number];

/** Stripe Checkout Session metadata (small, for reconciliation only). */
export type CheckoutSessionMetadata = {
  payment_order_id: string;
  supabase_user_id: string;
};

// --- DB port (implement with Drizzle + pool or Supabase server client) ---

export interface DbExecutor {
  transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;
  // narrow as needed for real implementation
}

// --- 1. Checkout creation ---

export type CreateCheckoutInput = {
  /** Resolved from session only; never from body. */
  buyerUserId: string;
  productSku?: WritingCheckoutSku;
  successUrl?: string;
  cancelUrl?: string;
};

export type CreateCheckoutResult = {
  checkoutUrl: string;
  paymentOrderId: string;
};

/**
 * Security: buyerUserId from verified JWT only.
 * Forbidden: any price/amount from client.
 */
export async function createWritingCheckout(
  _db: DbExecutor,
  _stripe: StripeCheckoutPort,
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  void _db;
  void _stripe;
  void input;
  throw new Error("implement: load products by SKU, insert payment_orders from catalog, stripe.checkout.sessions.create");
}

export interface StripeCheckoutPort {
  createCheckoutSession(params: {
    paymentOrderId: string;
    buyerUserId: string;
    successUrl: string;
    cancelUrl: string;
    /** Amount in minor units; from products row only. */
    amountTotalYen: number;
    currency: "jpy";
  }): Promise<{ url: string }>;
}

// --- 2. Webhook ---

export type RawWebhookRequest = {
  /** Raw bytes as provided by the platform (Node: Buffer is compatible with Uint8Array). */
  rawBody: Uint8Array;
  stripeSignature: string | undefined;
};

/**
 * Idempotent: same event.id → no duplicate entitlements / courses.
 * Source of truth for payment completion.
 */
export async function handleStripeWebhook(
  _db: DbExecutor,
  _stripe: StripeWebhookPort,
  req: RawWebhookRequest
): Promise<{ status: 200 | 401 | 400 }> {
  void _db;
  void _stripe;
  void req;
  throw new Error("implement: constructEvent, idempotency, fulfillWritingPurchase in transaction");
}

export interface StripeWebhookPort {
  constructEvent(rawBody: Uint8Array, signature: string, secret: string): StripeCheckoutSessionCompletedEvent;
}

/** Minimal shape for checkout.session.completed */
export type StripeCheckoutSessionCompletedEvent = {
  id: string;
  type: "checkout.session.completed";
  data: {
    object: {
      id: string;
      amount_total: number | null;
      currency: string;
      metadata: Record<string, string>;
      payment_intent?: string | null;
    };
  };
};

// --- 3–4. Fulfillment (entitlement + writing.courses) ---

export type FulfillWritingPurchaseInput = {
  paymentOrderId: string;
  stripeEventId: string;
  stripePaymentIntentId?: string | null;
  /** Validated amount_total from Stripe (yen). */
  amountTotalYen: number;
};

/**
 * Single transaction:
 * - record webhook / idempotency
 * - payment_orders → succeeded
 * - insert entitlements
 * - insert writing.courses (pending_setup, session_count=10)
 */
export async function fulfillWritingPurchase(
  _db: DbExecutor,
  input: FulfillWritingPurchaseInput
): Promise<void> {
  void _db;
  void input;
  throw new Error("implement: TRANSACTION; validate amount vs products; insert entitlement + course");
}

// --- 5. Schedule + sessions ---

export type ProvisionScheduleInput = {
  courseId: string;
  /** From auth session only. */
  actorUserId: string;
  startDateIso: string;
  interval: CourseInterval;
};

/**
 * Single transaction:
 * - update writing.courses → active, start_date, interval
 * - insert 10 writing.sessions with computed unlock_at
 */
export async function provisionWritingSessions(
  _db: DbExecutor,
  input: ProvisionScheduleInput
): Promise<void> {
  void _db;
  void input;
  throw new Error("implement: authorize course.user_id; compute unlock_at; insert 10 rows");
}

/** Pure helper for tests; unlock times in production are computed in Postgres (see server/lib/schedule). */
export { computeSessionUnlockTimes, DEFAULT_TZ } from "../lib/schedule";
