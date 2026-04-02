import Stripe from "stripe";

import { getDb } from "../db/client";
import * as repo from "../repositories/platformWritingRepository";
import { fulfillWritingPurchase } from "./writingFulfillment";
import { sendTrialLessonEmailsFromStripeSession } from "./trialLessonEmails";
import { TRIAL_LESSON_AMOUNT_JPY } from "./trialLessonStripe";

/** Vercel 純サーバレスでは `next/server` の NextResponse がランタイムエラーになることがあるため Web 標準のみ使う */
function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function empty(status: number): Response {
  return new Response(null, { status });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/webhooks/stripe — Vercel `api/webhooks/stripe.ts` と Next `app/api/...` の両方から呼ぶ。
 */
export async function handleWritingStripeWebhookPost(req: Request): Promise<Response> {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY missing");
    return json({ error: "server_misconfigured" }, 500);
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET missing");
    return json({ error: "server_misconfigured" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "missing_signature" }, 400);
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const stripe = new Stripe(stripeKey, { typescript: true });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return json({ error: "invalid_signature" }, 401);
  }

  if (event.type !== "checkout.session.completed") {
    return empty(200);
  }

  const session = event.data.object as Stripe.Checkout.Session;

  console.info("writing_stripe_webhook_checkout_completed", {
    stripeEventId: event.id,
    sessionId: session.id,
    metadataKeys: session.metadata ? Object.keys(session.metadata).sort() : [],
    trialEntitlement: session.metadata?.trial_entitlement === "true",
    trialLesson: session.metadata?.trial_lesson === "true",
  });

  if (session.metadata?.trial_entitlement === "true") {
    const applicationId =
      typeof session.metadata.application_id === "string" ? session.metadata.application_id.trim() : "";
    if (!applicationId || !UUID_RE.test(applicationId)) {
      console.error("writing_webhook_trial_entitlement_bad_metadata", {
        sessionId: session.id,
        hasApplicationId: Boolean(applicationId),
      });
      return json({ error: "invalid_trial_entitlement_metadata" }, 400);
    }

    const apiBase = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
    const fulfillSecret = process.env.TRIAL_FULFILL_WEBHOOK_SECRET?.trim() ?? "";
    if (!apiBase || !fulfillSecret) {
      console.error("writing_webhook_trial_entitlement_misconfigured", {
        hasApiBase: Boolean(apiBase),
        hasFulfillSecret: Boolean(fulfillSecret),
      });
      return json({ error: "server_misconfigured" }, 500);
    }

    const url = `${apiBase.replace(/\/$/, "")}/api/internal/trial/fulfill-checkout-session`;
    console.info("writing_webhook_branch", {
      stripeEventId: event.id,
      sessionId: session.id,
      branch: "trial_entitlement_proxy",
      target: "mirinae_api_fulfill_internal",
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trial-Fulfill-Secret": fulfillSecret,
        },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error("writing_webhook_trial_entitlement_proxy_failed", {
          status: res.status,
          body: text.slice(0, 500),
          sessionId: session.id,
        });
        return json({ error: "trial_entitlement_fulfill_failed" }, 502);
      }
      console.info("writing_webhook_trial_entitlement_proxy_ok", {
        stripeEventId: event.id,
        sessionId: session.id,
        responsePreview: text.slice(0, 200),
      });
    } catch (e) {
      console.error("writing_webhook_trial_entitlement_proxy_error", e);
      return json({ error: "trial_entitlement_fulfill_failed" }, 502);
    }

    return empty(200);
  }

  if (session.metadata?.trial_lesson === "true") {
    const currency = (session.currency ?? "").toLowerCase();
    if (currency !== "jpy") {
      return json({ error: "unsupported_currency" }, 400);
    }
    const amountTotal = session.amount_total;
    if (amountTotal == null) {
      return json({ error: "missing_amount" }, 400);
    }
    if (amountTotal !== TRIAL_LESSON_AMOUNT_JPY) {
      console.error("trial_lesson_amount_mismatch", {
        amountTotal,
        expected: TRIAL_LESSON_AMOUNT_JPY,
        sessionId: session.id,
      });
      return json({ error: "amount_mismatch" }, 400);
    }

    let db: ReturnType<typeof getDb>;
    try {
      db = getDb();
    } catch (e) {
      console.error("writing_webhook_getdb_failed", e);
      return json({ error: "database_unavailable" }, 500);
    }
    const recorded = await repo.insertStripeWebhookEvent(db, {
      stripeEventId: event.id,
      payloadHash: null,
    });
    if (!recorded) {
      console.info("writing_webhook_trial_lesson_duplicate", { stripeEventId: event.id });
      return empty(200);
    }

    console.info("writing_webhook_branch", {
      stripeEventId: event.id,
      sessionId: session.id,
      branch: "trial_lesson",
      mailFn: "sendTrialLessonEmailsFromStripeSession",
      studentLinkKind: "legacy_app_link",
    });

    try {
      await sendTrialLessonEmailsFromStripeSession(session);
    } catch (e) {
      console.error("trial_lesson_email_send_error", e);
    }

    console.info("trial_lesson_checkout_completed", {
      stripeEventId: event.id,
      sessionId: session.id,
      customerEmail: session.customer_details?.email ?? session.customer_email,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });
    return empty(200);
  }

  const paymentOrderId = session.metadata?.payment_order_id;
  const supabaseUserId = session.metadata?.supabase_user_id ?? null;

  if (!paymentOrderId) {
    return json({ error: "missing_payment_order" }, 400);
  }

  const currency = (session.currency ?? "").toLowerCase();
  if (currency !== "jpy") {
    return json({ error: "unsupported_currency" }, 400);
  }

  const amountTotal = session.amount_total;
  if (amountTotal == null) {
    return json({ error: "missing_amount" }, 400);
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === "object"
        ? session.payment_intent.id
        : null;

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch (e) {
    console.error("writing_webhook_getdb_failed", e);
    return json({ error: "database_unavailable" }, 500);
  }

  const result = await fulfillWritingPurchase(db, {
    paymentOrderId,
    stripeEventId: event.id,
    stripePaymentIntentId: paymentIntentId,
    amountTotalYen: amountTotal,
    metadataSupabaseUserId: supabaseUserId,
  });

  if (!result.ok) {
    console.error("fulfillment_failed", result.reason);
    return json({ error: result.reason }, 500);
  }

  console.info("writing_webhook_branch", {
    stripeEventId: event.id,
    sessionId: session.id,
    branch: "writing_purchase_fulfillment",
  });

  return empty(200);
}
