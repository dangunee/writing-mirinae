import Stripe from "stripe";

import type { CreateCheckoutInput, CreateCheckoutResult } from "../design/payment-to-course-flow";
import { WRITING_PRODUCT_SKU } from "../design/payment-to-course-flow";
import type { Db } from "../db/client";
import * as repo from "../repositories/platformWritingRepository";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(key, { typescript: true });
}

/**
 * Server-owned catalog + snapshot on payment_orders; Stripe amount from products.total_jpy only.
 * Security: buyerUserId must come from verified Supabase session, never from the request body.
 */
export async function createWritingCheckoutSession(
  db: Db,
  input: CreateCheckoutInput & {
    successUrl: string;
    cancelUrl: string;
  }
): Promise<CreateCheckoutResult> {
  const sku = input.productSku ?? WRITING_PRODUCT_SKU;
  const product = await repo.findActiveProductBySku(db, sku);
  if (!product) {
    throw new Error("product_not_found");
  }

  const stripe = getStripe();

  const order = await repo.insertPaymentOrder(db, {
    userId: input.buyerUserId,
    productId: product.id,
    status: "pending",
    currency: product.currency,
    unitPriceJpy: product.unitPriceJpy,
    quantity: product.quantity,
    subtotalJpy: product.subtotalJpy,
    taxRate: product.taxRate,
    totalJpy: product.totalJpy,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeEventId: null,
    paidAt: null,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: product.totalJpy,
          product_data: {
            name: product.name,
          },
        },
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: order.id,
    metadata: {
      payment_order_id: order.id,
      supabase_user_id: input.buyerUserId,
    },
    payment_intent_data: {
      metadata: {
        payment_order_id: order.id,
        supabase_user_id: input.buyerUserId,
      },
    },
  });

  if (!session.url) {
    await repo.updatePaymentOrderById(db, order.id, { status: "failed" });
    throw new Error("stripe_no_checkout_url");
  }

  await repo.updatePaymentOrderById(db, order.id, {
    stripeCheckoutSessionId: session.id,
  });

  return {
    checkoutUrl: session.url,
    paymentOrderId: order.id,
  };
}
