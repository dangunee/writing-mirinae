import { NextResponse } from "next/server";

import { parseCheckoutAllowlist, assertUrlAllowed } from "../../../../../server/lib/urls";
import { createTrialLessonCheckoutSession } from "../../../../../server/services/trialLessonStripe";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/writing/trial-payment/create-checkout-session
 * 金額はサーバー固定 ¥1,800 のみ。クライアントからの金額フィールドは拒否。
 *
 * - `MIRINAE_API_BASE_URL` があれば mirinae-api `POST /api/trial/applications` にプロキシし、
 *   Stripe metadata に `trial_entitlement` + `application_id` が付く（webhook でトークンリンクメール）。
 * - 未設定時は writing-mirinae 側で Checkout を作成（metadata に `trial_entitlement: "true"` のみ。
 *   `application_id` は付かないため本番の internal fulfill には mirinae-api 経由を推奨）。
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

  const inquiryParts = [
    inquiry,
    `開始日: ${startDateLabel} (${startDate})`,
    furigana ? `ふりがな: ${furigana}` : null,
  ].filter(Boolean) as string[];
  const inquiryCombined = inquiryParts.join("\n\n");

  const apiBase = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";

  if (apiBase) {
    const target = `${apiBase.replace(/\/$/, "")}/api/trial/applications`;
    console.info("trial_checkout_proxy_to_mirinae_api", {
      targetHost: (() => {
        try {
          return new URL(target).host;
        } catch {
          return "invalid";
        }
      })(),
      paymentFlow: "trial_entitlement",
    });

    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          koreanLevel,
          inquiry: inquiryCombined || undefined,
          paymentMethod: "card",
          successUrl,
          cancelUrl,
          startDate,
          startDateLabel,
          furigana,
        }),
      });
      const text = await res.text();
      let json: { ok?: boolean; checkoutUrl?: string; error?: string } = {};
      try {
        json = text ? (JSON.parse(text) as typeof json) : {};
      } catch {
        return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
      }
      if (!res.ok || json.ok !== true || typeof json.checkoutUrl !== "string") {
        console.error("trial_checkout_proxy_error", { status: res.status, body: text.slice(0, 400) });
        return NextResponse.json(
          { error: json.error ?? "checkout_failed" },
          { status: res.status >= 400 ? res.status : 502 }
        );
      }
      return NextResponse.json({ checkoutUrl: json.checkoutUrl });
    } catch (e) {
      console.error("trial_checkout_proxy_fetch_error", e);
      return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
    }
  }

  console.warn("trial_checkout_fallback_local_stripe", {
    reason: "MIRINAE_API_BASE_URL missing",
    note: "trial_entitlement metadata without application_id; use mirinae-api proxy in production",
  });

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
