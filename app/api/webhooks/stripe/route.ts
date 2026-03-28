import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getDb } from "../../../../server/db/client";
import { fulfillWritingPurchase } from "../../../../server/services/writingFulfillment";

export const runtime = "nodejs";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(key, { typescript: true });
}

/**
 * POST /api/webhooks/stripe
 * Security: Stripe-Signature only — no user session. Raw body required for verification.
 * Payment success is recorded only here (webhook is source of truth).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (event.type !== "checkout.session.completed") {
    return new NextResponse(null, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const paymentOrderId = session.metadata?.payment_order_id;
  const supabaseUserId = session.metadata?.supabase_user_id ?? null;

  if (!paymentOrderId) {
    return NextResponse.json({ error: "missing_payment_order" }, { status: 400 });
  }

  const currency = (session.currency ?? "").toLowerCase();
  if (currency !== "jpy") {
    return NextResponse.json({ error: "unsupported_currency" }, { status: 400 });
  }

  const amountTotal = session.amount_total;
  if (amountTotal == null) {
    return NextResponse.json({ error: "missing_amount" }, { status: 400 });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === "object"
        ? session.payment_intent.id
        : null;

  const db = getDb();
  const result = await fulfillWritingPurchase(db, {
    paymentOrderId,
    stripeEventId: event.id,
    stripePaymentIntentId: paymentIntentId,
    amountTotalYen: amountTotal,
    metadataSupabaseUserId: supabaseUserId,
  });

  if (!result.ok) {
    console.error("fulfillment_failed", result.reason);
    return NextResponse.json({ error: result.reason }, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
