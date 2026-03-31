import { NextResponse } from "next/server";

import {
  WRITING_CHECKOUT_SKUS,
  WRITING_PRODUCT_SKU,
  type WritingCheckoutSku,
} from "../../../../server/design/payment-to-course-flow";
import { getDb } from "../../../../server/db/client";
import { parseCheckoutAllowlist, assertUrlAllowed } from "../../../../server/lib/urls";
import { getSessionUserId } from "../../../../server/lib/supabaseServer";
import { createWritingCheckoutSession } from "../../../../server/services/writingCheckout";

export const runtime = "nodejs";

/**
 * POST /api/writing/checkout
 * Security: identity from Supabase session only; amounts from catalog (createWritingCheckoutSession).
 * Rate limiting: add per-IP / per-user limits at the edge (not implemented here).
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    "price" in body ||
    "amount" in body ||
    "total" in body ||
    "currency" in body ||
    "userId" in body ||
    "email" in body
  ) {
    return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
  }

  const allowlist = parseCheckoutAllowlist();
  const successUrl =
    typeof body.successUrl === "string" && body.successUrl
      ? body.successUrl
      : process.env.DEFAULT_CHECKOUT_SUCCESS_URL ?? "";
  const cancelUrl =
    typeof body.cancelUrl === "string" && body.cancelUrl
      ? body.cancelUrl
      : process.env.DEFAULT_CHECKOUT_CANCEL_URL ?? "";

  try {
    assertUrlAllowed(successUrl, allowlist);
    assertUrlAllowed(cancelUrl, allowlist);
  } catch {
    return NextResponse.json({ error: "invalid_redirect_urls" }, { status: 400 });
  }

  const productSkuRaw =
    typeof body.productSku === "string" ? body.productSku : WRITING_PRODUCT_SKU;
  if (!WRITING_CHECKOUT_SKUS.includes(productSkuRaw as (typeof WRITING_CHECKOUT_SKUS)[number])) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }
  const productSku = productSkuRaw as WritingCheckoutSku;

  try {
    const db = getDb();
    const result = await createWritingCheckoutSession(db, {
      buyerUserId: userId,
      productSku,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      paymentOrderId: result.paymentOrderId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    if (msg === "product_not_found") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("checkout_error", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
