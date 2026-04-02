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

const INTERNAL_FULFILL_PATH = "/api/internal/trial/fulfill-checkout-session";

/** トークン等をログに出さない — metadata はキーとフラグのみ */
function metadataDebug(meta: Stripe.Metadata | null | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== "object") {
    return { keys: [] as string[] };
  }
  const keys = Object.keys(meta).sort();
  return {
    keys,
    trial_entitlement: meta.trial_entitlement === "true",
    trial_lesson: meta.trial_lesson === "true",
    has_application_id: typeof meta.application_id === "string" && meta.application_id.length > 0,
    has_payment_order_id: typeof meta.payment_order_id === "string" && meta.payment_order_id.length > 0,
  };
}

/**
 * POST /api/webhooks/stripe — Vercel `api/webhooks/stripe.ts` と Next `app/api/...` の両方から呼ぶ。
 */
export async function handleWritingStripeWebhookPost(req: Request): Promise<Response> {
  try {
    return await handleWritingStripeWebhookPostInner(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("writing_stripe_webhook_fatal", { message, stack });
    return json({ error: "internal_error" }, 500);
  }
}

async function handleWritingStripeWebhookPostInner(req: Request): Promise<Response> {
  console.info("writing_stripe_webhook_entry", {
    hasStripeSecretKey: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    hasStripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    hasMirinaeApiBaseUrl: Boolean(process.env.MIRINAE_API_BASE_URL?.trim()),
    hasTrialFulfillSecret: Boolean(process.env.TRIAL_FULFILL_WEBHOOK_SECRET?.trim()),
  });

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    console.error("writing_stripe_webhook_env_missing", { key: "STRIPE_SECRET_KEY" });
    return json({ error: "server_misconfigured" }, 500);
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("writing_stripe_webhook_env_missing", { key: "STRIPE_WEBHOOK_SECRET" });
    return json({ error: "server_misconfigured" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.warn("writing_stripe_webhook_missing_signature_header");
    return json({ error: "missing_signature" }, 400);
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const stripe = new Stripe(stripeKey, { typescript: true });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("writing_stripe_webhook_construct_event_failed", { message });
    return json({ error: "invalid_signature" }, 401);
  }

  console.info("writing_stripe_webhook_event_parsed", {
    eventType: event.type,
    stripeEventId: event.id,
  });

  if (event.type !== "checkout.session.completed") {
    console.info("writing_stripe_webhook_event_ignored", { eventType: event.type, reason: "not_checkout_session_completed" });
    return empty(200);
  }

  const session = event.data.object as Stripe.Checkout.Session;

  console.info("writing_stripe_webhook_checkout_session", {
    stripeEventId: event.id,
    sessionId: session.id,
    metadata: metadataDebug(session.metadata),
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
    let fulfillHost = "";
    try {
      fulfillHost = apiBase ? new URL(apiBase.endsWith("/") ? apiBase : `${apiBase}/`).host : "";
    } catch {
      fulfillHost = "invalid_url";
    }

    console.info("writing_webhook_branch_decision", {
      branch: "trial_entitlement",
      sessionId: session.id,
      mirinaeApiBaseUrlPresent: Boolean(apiBase),
      mirinaeApiHost: fulfillHost || undefined,
      trialFulfillSecretPresent: Boolean(fulfillSecret),
      internalPath: INTERNAL_FULFILL_PATH,
    });

    if (!apiBase || !fulfillSecret) {
      console.error("writing_webhook_trial_entitlement_misconfigured", {
        hasApiBase: Boolean(apiBase),
        hasFulfillSecret: Boolean(fulfillSecret),
      });
      return json({ error: "server_misconfigured" }, 500);
    }

    const url = `${apiBase.replace(/\/$/, "")}${INTERNAL_FULFILL_PATH}`;
    console.info("writing_webhook_internal_fulfill_precall", {
      sessionId: session.id,
      fulfillUrlHost: fulfillHost,
      fulfillPath: INTERNAL_FULFILL_PATH,
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
      console.info("writing_webhook_internal_fulfill_response", {
        sessionId: session.id,
        status: res.status,
        responseBodyLength: text.length,
        responseBodyPreview: text.slice(0, 2000),
      });
      if (!res.ok) {
        console.error("writing_webhook_trial_entitlement_proxy_failed", {
          status: res.status,
          body: text.slice(0, 2000),
          sessionId: session.id,
        });
        return json({ error: "trial_entitlement_fulfill_failed" }, 502);
      }
      console.info("writing_webhook_trial_entitlement_proxy_ok", {
        stripeEventId: event.id,
        sessionId: session.id,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("writing_webhook_trial_entitlement_proxy_error", { message, stack: e instanceof Error ? e.stack : undefined });
      return json({ error: "trial_entitlement_fulfill_failed" }, 502);
    }

    return empty(200);
  }

  if (session.metadata?.trial_lesson === "true") {
    console.info("writing_webhook_branch_decision", { branch: "trial_lesson", sessionId: session.id });

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
      const message = e instanceof Error ? e.message : String(e);
      console.error("writing_webhook_getdb_failed", { message });
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
      const message = e instanceof Error ? e.message : String(e);
      console.error("trial_lesson_email_send_error", { message });
    }

    console.info("trial_lesson_checkout_completed", {
      stripeEventId: event.id,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return empty(200);
  }

  const paymentOrderId = session.metadata?.payment_order_id;
  const supabaseUserId = session.metadata?.supabase_user_id ?? null;

  if (!paymentOrderId) {
    console.warn("writing_webhook_branch_decision", {
      branch: "none",
      reason: "missing_payment_order_and_not_trial",
      sessionId: session.id,
    });
    return json({ error: "missing_payment_order" }, 400);
  }

  console.info("writing_webhook_branch_decision", { branch: "payment_order", sessionId: session.id, hasPaymentOrderId: true });

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
    const message = e instanceof Error ? e.message : String(e);
    console.error("writing_webhook_getdb_failed", { message });
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
