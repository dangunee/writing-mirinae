/**
 * Vercel Serverless — `vite build` では Next `app/api` がデプロイされないため、
 * このファイルで `/api/webhooks/stripe` を提供する。
 *
 * Vercel Node ランタイムは `IncomingMessage` / `ServerResponse` を渡すことが多く、
 * Web `Request` の `arrayBuffer()` は存在しない → raw body を自前で読む。
 *
 * `server/` は serverless バンドルに含まれないため、webhook 処理はこのファイルに完結させる。
 * (constructEvent, trial_entitlement / trial_lesson / payment_order 分岐, internal fulfill, DB)
 */
import type { IncomingMessage, ServerResponse } from "http";

import { eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Stripe from "stripe";

import * as schema from "../../db/schema";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
  api: {
    bodyParser: false,
  },
};

type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;

function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for API routes");
  }
  if (!_db) {
    const client = postgres(url, {
      ssl: "require",
      max: 1,
      prepare: false,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

/** 体験レッスン — サーバー固定金額（Stripe / メール共通）。 */
const TRIAL_LESSON_AMOUNT_JPY = 1800;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INTERNAL_FULFILL_PATH = "/api/internal/trial/fulfill-checkout-session";

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

/** 学習者リンクは常に「サイトオリジン + /writing/app」。SITE_URL にパスが含まれると /writing/writing/app になるため origin のみ使う */
function siteBaseUrl(): string {
  const raw =
    process.env.TRIAL_WRITING_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "https://writing-mirinae.vercel.app";
  try {
    const u = new URL(raw.endsWith("/") ? raw : `${raw}/`);
    return u.origin;
  } catch {
    return "https://writing-mirinae.vercel.app";
  }
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * Resend REST API — RESEND_API_KEY が無い場合はスキップ（ログのみ）
 */
async function sendTrialLessonEmailsFromStripeSession(session: Stripe.Checkout.Session): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const adminTo = process.env.TRIAL_LESSON_ADMIN_EMAIL?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Writing <onboarding@resend.dev>";

  const meta = session.metadata ?? {};
  const fullName = meta.full_name ?? "";
  const furigana = meta.furigana ?? "";
  const email = (session.customer_details?.email ?? session.customer_email ?? "").trim();
  const koreanLevel = meta.korean_level ?? "";
  const startDate = meta.start_date ?? "";
  const startDateLabel = meta.start_date_label ?? "";
  const inquiry = meta.inquiry?.trim() ?? "";

  if (!apiKey) {
    console.warn("trial_lesson_email_skipped", { reason: "RESEND_API_KEY missing" });
    return;
  }

  const adminSubject = `[体験レッスン] 決済完了 ${fullName || email || session.id}`;
  const adminText = [
    "体験レッスンの決済が完了しました。",
    "",
    `Stripe Session: ${session.id}`,
    `金額: ${TRIAL_LESSON_AMOUNT_JPY} JPY`,
    `タイプ: trial lesson`,
    "",
    `お名前: ${mdEscape(fullName)}`,
    `ふりがな: ${mdEscape(furigana)}`,
    `メール: ${mdEscape(email)}`,
    `韓国語レベル: ${mdEscape(koreanLevel)}`,
    `開始日(ISO): ${mdEscape(startDate)}`,
    `開始日(表示): ${mdEscape(startDateLabel)}`,
    inquiry ? `お問い合わせ: ${mdEscape(inquiry)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const base = siteBaseUrl();
  const studentAppUrl = `${base}/writing/app`;
  console.info("trial_lesson_student_link_built", {
    linkKind: "legacy_app_link",
    studentAppPath: "/writing/app",
  });
  const studentSubject = "【ミリネ韓国語教室】体験レッスンのお申し込みが完了しました";
  const studentText = [
    `${fullName || "お客様"} 様`,
    "",
    "このたびは、ミリネ韓国語教室 作文トレーニング体験レッスンに",
    "お申し込みいただき、ありがとうございます。",
    "",
    "お支払いの確認が完了しました。",
    "下記リンクより、すぐに課題作成を開始していただけます。",
    "",
    "課題開始:",
    studentAppUrl,
    "",
    "※ お支払い完了後の返金はできませんので、あらかじめご了承ください。",
    "",
    "ミリネ韓国語教室",
  ].join("\n");

  const send = async (to: string, subject: string, text: string) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`resend_${res.status}: ${errText}`);
    }
  };

  if (adminTo) {
    try {
      await send(adminTo, adminSubject, adminText);
    } catch (e) {
      console.error("trial_lesson_admin_email_failed", e);
    }
  } else {
    console.warn("trial_lesson_admin_email_skipped", { reason: "TRIAL_LESSON_ADMIN_EMAIL missing" });
  }

  if (email) {
    try {
      await send(email, studentSubject, studentText);
    } catch (e) {
      console.error("trial_lesson_student_email_failed", e);
    }
  }
}

async function insertStripeWebhookEvent(
  db: Db,
  row: typeof schema.stripeWebhookEvents.$inferInsert
): Promise<boolean> {
  const inserted = await db
    .insert(schema.stripeWebhookEvents)
    .values(row)
    .onConflictDoNothing({ target: schema.stripeWebhookEvents.stripeEventId })
    .returning({ id: schema.stripeWebhookEvents.id });
  return inserted.length > 0;
}

/**
 * Webhook-only fulfillment: idempotent via stripe_webhook_events + entitlements uniqueness.
 * Security: amount and metadata cross-checks; row lock on payment_orders for concurrent webhooks.
 */
async function fulfillWritingPurchase(
  db: Db,
  input: {
    paymentOrderId: string;
    stripeEventId: string;
    stripePaymentIntentId: string | null;
    amountTotalYen: number;
    metadataSupabaseUserId: string | null | undefined;
  }
): Promise<{ ok: true; skippedDuplicateEvent: boolean } | { ok: false; reason: string }> {
  return db.transaction(async (tx) => {
    const recorded = await insertStripeWebhookEvent(tx, {
      stripeEventId: input.stripeEventId,
      payloadHash: null,
    });
    if (!recorded) {
      return { ok: true, skippedDuplicateEvent: true };
    }

    const orderRows = await tx
      .select()
      .from(schema.paymentOrders)
      .where(eq(schema.paymentOrders.id, input.paymentOrderId))
      .for("update")
      .limit(1);
    const order = orderRows[0] ?? null;
    if (!order) {
      return { ok: false, reason: "payment_order_not_found" };
    }

    if (order.status === "succeeded") {
      return { ok: true, skippedDuplicateEvent: false };
    }

    if (order.status !== "pending") {
      return { ok: false, reason: "order_not_pending" };
    }

    if (order.totalJpy !== input.amountTotalYen) {
      return { ok: false, reason: "amount_mismatch_order" };
    }

    const [product] = await tx
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, order.productId))
      .limit(1);
    if (!product) {
      return { ok: false, reason: "product_not_found" };
    }
    if (product.totalJpy !== input.amountTotalYen) {
      return { ok: false, reason: "amount_mismatch_product" };
    }

    if (input.metadataSupabaseUserId && input.metadataSupabaseUserId !== order.userId) {
      return { ok: false, reason: "metadata_user_mismatch" };
    }

    await tx
      .update(schema.paymentOrders)
      .set({
        status: "succeeded",
        paidAt: new Date(),
        stripeEventId: input.stripeEventId,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      })
      .where(eq(schema.paymentOrders.id, order.id));

    const [entitlement] = await tx
      .insert(schema.entitlements)
      .values({
        userId: order.userId,
        productId: order.productId,
        paymentOrderId: order.id,
        app: "writing",
        status: "active",
        validFrom: new Date(),
        validUntil: null,
        metadata: {},
      })
      .returning();

    if (!entitlement) {
      return { ok: false, reason: "entitlement_insert_failed" };
    }

    await tx.insert(schema.writingCourses).values({
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
    console.info("writing_stripe_webhook_event_ignored", {
      eventType: event.type,
      reason: "not_checkout_session_completed",
    });
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
      console.error("writing_webhook_trial_entitlement_proxy_error", {
        message,
        stack: e instanceof Error ? e.stack : undefined,
      });
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

    let db: Db;
    try {
      db = getDb();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("writing_webhook_getdb_failed", { message });
      return json({ error: "database_unavailable" }, 500);
    }
    const recorded = await insertStripeWebhookEvent(db, {
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

  console.info("writing_webhook_branch_decision", {
    branch: "payment_order",
    sessionId: session.id,
    hasPaymentOrderId: true,
  });

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

  let db: Db;
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

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  console.info("writing_stripe_webhook_vercel_handler_entry", {
    method: req.method,
    host: req.headers.host,
    urlPath: req.url?.split("?")[0],
  });

  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    const host = req.headers.host ?? "localhost";
    const path = req.url?.split("?")[0] ?? "/api/webhooks/stripe";
    const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
    const url = `https://${host}${path}${search}`;

    const rawBody = await readRawBody(req);
    console.info("writing_stripe_webhook_raw_body", {
      rawBodyByteLength: rawBody.length,
      hasStripeSignatureHeader: Boolean(req.headers["stripe-signature"]),
    });

    const webRequest = new Request(url, {
      method: "POST",
      headers: req.headers as HeadersInit,
      body: rawBody,
    });

    const response = await handleWritingStripeWebhookPost(webRequest);
    const text = await response.text();
    console.info("writing_stripe_webhook_handler_response", {
      responseStatus: response.status,
      responseBodyLength: text.length,
    });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("writing_stripe_webhook_unhandled", { message, stack });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
