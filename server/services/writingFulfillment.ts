import { eq } from "drizzle-orm";

import { products } from "../../db/schema";
import type { FulfillWritingPurchaseInput } from "../design/payment-to-course-flow";
import type { Db } from "../db/client";
import * as repo from "../repositories/platformWritingRepository";

export type FulfillWritingPurchaseContext = FulfillWritingPurchaseInput & {
  /** From verified Stripe Checkout Session metadata; must match order.user_id if present. */
  metadataSupabaseUserId?: string | null;
  stripePaymentIntentId?: string | null;
};

/**
 * Webhook-only fulfillment: idempotent via stripe_webhook_events + entitlements uniqueness.
 * Security: amount and metadata cross-checks; row lock on payment_orders for concurrent webhooks.
 */
export async function fulfillWritingPurchase(
  db: Db,
  input: FulfillWritingPurchaseContext
): Promise<{ ok: true; skippedDuplicateEvent: boolean } | { ok: false; reason: string }> {
  return db.transaction(async (tx) => {
    const recorded = await repo.insertStripeWebhookEvent(tx, {
      stripeEventId: input.stripeEventId,
      payloadHash: null,
    });
    if (!recorded) {
      return { ok: true, skippedDuplicateEvent: true };
    }

    const order = await repo.lockPaymentOrderById(tx, input.paymentOrderId);
    if (!order) {
      return { ok: false, reason: "payment_order_not_found" };
    }

    if (order.status === "succeeded") {
      return { ok: true, skippedDuplicateEvent: false };
    }

    if (order.status !== "pending") {
      return { ok: false, reason: "order_not_pending" };
    }

    // Security: Stripe-reported total must match catalog snapshot on the order (server-owned pricing).
    if (order.totalJpy !== input.amountTotalYen) {
      return { ok: false, reason: "amount_mismatch_order" };
    }

    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1);
    if (!product) {
      return { ok: false, reason: "product_not_found" };
    }
    if (product.totalJpy !== input.amountTotalYen) {
      return { ok: false, reason: "amount_mismatch_product" };
    }

    // Defense in depth: metadata must agree with the buyer stored on the order (never trust metadata alone for money).
    if (
      input.metadataSupabaseUserId &&
      input.metadataSupabaseUserId !== order.userId
    ) {
      return { ok: false, reason: "metadata_user_mismatch" };
    }

    await repo.updatePaymentOrderById(tx, order.id, {
      status: "succeeded",
      paidAt: new Date(),
      stripeEventId: input.stripeEventId,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    });

    const entitlement = await repo.insertEntitlement(tx, {
      userId: order.userId,
      productId: order.productId,
      paymentOrderId: order.id,
      app: "writing",
      status: "active",
      validFrom: new Date(),
      validUntil: null,
      metadata: {},
    });

    await repo.insertWritingCourse(tx, {
      userId: order.userId,
      entitlementId: entitlement.id,
      status: "pending_setup",
      startDate: null,
      interval: null,
      sessionCount: product.quantity,
    });

    return { ok: true, skippedDuplicateEvent: false };
  });
}
