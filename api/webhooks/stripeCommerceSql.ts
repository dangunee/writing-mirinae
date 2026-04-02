/**
 * Stripe webhook の trial_lesson / payment_order 向け DB 処理。
 * `db/schema` や Drizzle に依存しない（Vercel serverless で /var/task/db が無いため raw SQL のみ）。
 */
import postgres from "postgres";

/** `TransactionSql` の型定義でテンプレート呼び出しが欠けるため、クエリ実行は `Sql` として扱う */
type Sql = postgres.Sql;

type SqlClient = ReturnType<typeof postgres>;

let _sql: SqlClient | null = null;

function getSql(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for API routes");
  }
  if (!_sql) {
    _sql = postgres(url, {
      ssl: "require",
      max: 1,
      prepare: false,
    });
  }
  return _sql;
}

export async function insertStripeWebhookEventIdempotent(stripeEventId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO stripe_webhook_events (stripe_event_id, payload_hash)
    VALUES (${stripeEventId}, ${null})
    ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export type FulfillWritingPurchaseSqlResult =
  | { ok: true; skippedDuplicateEvent: boolean }
  | { ok: false; reason: string };

export async function fulfillWritingPurchaseSql(input: {
  paymentOrderId: string;
  stripeEventId: string;
  stripePaymentIntentId: string | null;
  amountTotalYen: number;
  metadataSupabaseUserId: string | null | undefined;
}): Promise<FulfillWritingPurchaseSqlResult> {
  const sql = getSql();

  return await sql.begin(async (tx) => {
    const q = tx as unknown as Sql;
    const inserted = await q`
      INSERT INTO stripe_webhook_events (stripe_event_id, payload_hash)
      VALUES (${input.stripeEventId}, ${null})
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 0) {
      return { ok: true, skippedDuplicateEvent: true };
    }

    const orders = await q`
      SELECT *
      FROM payment_orders
      WHERE id = ${input.paymentOrderId}
      FOR UPDATE
    `;
    const order = orders[0] as
      | {
          id: string;
          user_id: string;
          product_id: string;
          status: string;
          total_jpy: number;
        }
      | undefined;
    if (!order) {
      return { ok: false, reason: "payment_order_not_found" };
    }

    if (order.status === "succeeded") {
      return { ok: true, skippedDuplicateEvent: false };
    }

    if (order.status !== "pending") {
      return { ok: false, reason: "order_not_pending" };
    }

    const orderTotal = Number(order.total_jpy);
    if (orderTotal !== input.amountTotalYen) {
      return { ok: false, reason: "amount_mismatch_order" };
    }

    const products = await q`
      SELECT id, total_jpy, quantity
      FROM products
      WHERE id = ${order.product_id}
      LIMIT 1
    `;
    const product = products[0] as { id: string; total_jpy: number; quantity: number } | undefined;
    if (!product) {
      return { ok: false, reason: "product_not_found" };
    }

    const productTotal = Number(product.total_jpy);
    if (productTotal !== input.amountTotalYen) {
      return { ok: false, reason: "amount_mismatch_product" };
    }

    if (
      input.metadataSupabaseUserId &&
      input.metadataSupabaseUserId !== order.user_id
    ) {
      return { ok: false, reason: "metadata_user_mismatch" };
    }

    await q`
      UPDATE payment_orders
      SET
        status = 'succeeded',
        paid_at = NOW(),
        stripe_event_id = ${input.stripeEventId},
        stripe_payment_intent_id = ${input.stripePaymentIntentId}
      WHERE id = ${order.id}
    `;

    const entRows = await q`
      INSERT INTO entitlements (
        user_id,
        product_id,
        payment_order_id,
        app,
        status,
        valid_from,
        valid_until,
        metadata
      )
      VALUES (
        ${order.user_id},
        ${order.product_id},
        ${order.id},
        'writing',
        'active',
        NOW(),
        NULL,
        '{}'::jsonb
      )
      RETURNING id
    `;
    const entitlement = entRows[0] as { id: string } | undefined;
    if (!entitlement) {
      return { ok: false, reason: "entitlement_insert_failed" };
    }

    const qty = Number(product.quantity);
    await q`
      INSERT INTO writing.courses (
        user_id,
        entitlement_id,
        status,
        start_date,
        interval,
        session_count
      )
      VALUES (
        ${order.user_id},
        ${entitlement.id},
        'pending_setup',
        NULL,
        NULL,
        ${qty}
      )
    `;

    return { ok: true, skippedDuplicateEvent: false };
  });
}
