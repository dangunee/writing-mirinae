/**
 * POST /api/writing/trial-payment/create-checkout-session
 * Next `app/api/...` と Vercel `api/writing/...` から共有（api/_lib のみ import — Vercel バンドル用）。
 */
import { parseCheckoutAllowlist, assertUrlAllowed } from "./urls";
import { createTrialLessonCheckoutSession } from "./trialLessonStripe";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function handleTrialCreateCheckoutSessionRequest(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (
    "price" in body ||
    "amount" in body ||
    "total" in body ||
    "currency" in body ||
    "unit_amount" in body ||
    "line_items" in body
  ) {
    return json({ error: "forbidden_fields" }, 400);
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
    return json({ error: "invalid_redirect_urls" }, 400);
  }

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const startDateLabel = typeof body.startDateLabel === "string" ? body.startDateLabel.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const furigana = typeof body.furigana === "string" ? body.furigana.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const koreanLevel = typeof body.koreanLevel === "string" ? body.koreanLevel.trim() : "";
  const inquiry = typeof body.inquiry === "string" ? body.inquiry.trim() : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return json({ error: "invalid_start_date" }, 400);
  }
  if (!fullName || fullName.length > 200) {
    return json({ error: "invalid_full_name" }, 400);
  }
  if (!furigana || furigana.length > 200) {
    return json({ error: "invalid_furigana" }, 400);
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return json({ error: "invalid_email" }, 400);
  }
  if (!koreanLevel || koreanLevel.length > 200) {
    return json({ error: "invalid_korean_level" }, 400);
  }
  if (!startDateLabel || startDateLabel.length > 200) {
    return json({ error: "invalid_start_date_label" }, 400);
  }
  if (inquiry && inquiry.length > 2000) {
    return json({ error: "invalid_inquiry" }, 400);
  }

  const inquiryParts = [
    inquiry,
    `開始日: ${startDateLabel} (${startDate})`,
    furigana ? `ふりがな: ${furigana}` : null,
  ].filter(Boolean) as string[];
  const inquiryCombined = inquiryParts.join("\n\n");

  const rawMirinae = process.env.MIRINAE_API_BASE_URL;
  const mirinaeApiBaseUrl = typeof rawMirinae === "string" ? rawMirinae.trim() : "";
  const isProduction = process.env.NODE_ENV === "production";

  console.info("trial_checkout_route_config", {
    handler: "trial_create_checkout",
    hasMirinaeApiBaseUrl: mirinaeApiBaseUrl.length > 0,
    mirinaeApiBaseUrlLength: mirinaeApiBaseUrl.length,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });

  if (mirinaeApiBaseUrl.length > 0) {
    const target = `${mirinaeApiBaseUrl.replace(/\/$/, "")}/api/trial/applications`;
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
      let parsed: { ok?: boolean; checkoutUrl?: string; error?: string } = {};
      try {
        parsed = text ? (JSON.parse(text) as typeof parsed) : {};
      } catch {
        return json({ error: "checkout_failed" }, 502);
      }
      if (!res.ok || parsed.ok !== true || typeof parsed.checkoutUrl !== "string") {
        console.error("trial_checkout_proxy_error", { status: res.status, body: text.slice(0, 400) });
        return json(
          { error: parsed.error ?? "checkout_failed" },
          res.status >= 400 ? res.status : 502
        );
      }
      return json({ checkoutUrl: parsed.checkoutUrl }, 200);
    } catch (e) {
      console.error("trial_checkout_proxy_fetch_error", e);
      return json({ error: "checkout_failed" }, 502);
    }
  }

  if (isProduction) {
    console.error("trial_checkout_misconfigured", {
      reason: "MIRINAE_API_BASE_URL required in production",
      hasMirinaeApiBaseUrl: false,
    });
    return json({ error: "server_misconfigured" }, 500);
  }

  console.warn("trial_checkout_fallback_local_stripe", {
    reason: "MIRINAE_API_BASE_URL missing",
    note: "development_only: local Stripe session without application_id",
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
    return json({ checkoutUrl: url }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    console.error("trial_checkout_error", e);
    if (msg === "STRIPE_SECRET_KEY is required") {
      return json({ error: "server_misconfigured" }, 500);
    }
    return json({ error: "checkout_failed" }, 500);
  }
}
