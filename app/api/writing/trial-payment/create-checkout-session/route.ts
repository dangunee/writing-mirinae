import { NextResponse } from "next/server";

import { parseCheckoutAllowlist, assertUrlAllowed } from "../../../../../server/lib/urls";
import { createTrialLessonCheckoutSession } from "../../../../../server/services/trialLessonStripe";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/writing/trial-payment/create-checkout-session
 * 金額はサーバー固定 ¥1,800 のみ。クライアントからの金額フィールドは拒否。
 */
export async function POST(req: Request) {
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
    "unit_amount" in body ||
    "line_items" in body
  ) {
    return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
  }

  const successUrl =
    typeof body.successUrl === "string" && body.successUrl.trim()
      ? body.successUrl.trim()
      : process.env.TRIAL_PAYMENT_SUCCESS_URL?.trim() ?? "";
  const cancelUrl =
    typeof body.cancelUrl === "string" && body.cancelUrl.trim()
      ? body.cancelUrl.trim()
      : process.env.TRIAL_PAYMENT_CANCEL_URL?.trim() ?? "";

  const allowlist = parseCheckoutAllowlist();
  try {
    assertUrlAllowed(successUrl, allowlist);
    assertUrlAllowed(cancelUrl, allowlist);
  } catch {
    return NextResponse.json({ error: "invalid_redirect_urls" }, { status: 400 });
  }

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const startDateLabel = typeof body.startDateLabel === "string" ? body.startDateLabel.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const furigana = typeof body.furigana === "string" ? body.furigana.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const koreanLevel = typeof body.koreanLevel === "string" ? body.koreanLevel.trim() : "";
  const inquiry = typeof body.inquiry === "string" ? body.inquiry.trim() : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "invalid_start_date" }, { status: 400 });
  }
  if (!fullName || fullName.length > 200) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }
  if (!furigana || furigana.length > 200) {
    return NextResponse.json({ error: "invalid_furigana" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!koreanLevel || koreanLevel.length > 200) {
    return NextResponse.json({ error: "invalid_korean_level" }, { status: 400 });
  }
  if (!startDateLabel || startDateLabel.length > 200) {
    return NextResponse.json({ error: "invalid_start_date_label" }, { status: 400 });
  }
  if (inquiry && inquiry.length > 2000) {
    return NextResponse.json({ error: "invalid_inquiry" }, { status: 400 });
  }

  try {
    const { url } = await createTrialLessonCheckoutSession({
      successUrl,
      cancelUrl,
      startDate,
      startDateLabel,
      fullName,
      furigana,
      email,
      koreanLevel,
      inquiry: inquiry || undefined,
    });
    return NextResponse.json({ checkoutUrl: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    console.error("trial_checkout_error", e);
    if (msg === "STRIPE_SECRET_KEY is required") {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
