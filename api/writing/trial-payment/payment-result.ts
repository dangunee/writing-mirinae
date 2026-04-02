/**
 * Vercel Serverless — 単一ファイル完結（外部 handler import なし）
 */
import type { IncomingMessage, ServerResponse } from "http";

import Stripe from "stripe";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

const TRIAL_LESSON_AMOUNT_JPY = 1800;

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(key, { typescript: true });
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleTrialPaymentResultGet(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return json({ error: "session_id_required" }, 400);
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const currency = (session.currency ?? "").toLowerCase();
    if (currency !== "jpy") {
      return json({ error: "unsupported_currency" }, 400);
    }

    const amountTotal = session.amount_total;
    if (amountTotal == null || amountTotal !== TRIAL_LESSON_AMOUNT_JPY) {
      return json({ error: "amount_mismatch" }, 400);
    }

    const isPaid = session.payment_status === "paid";
    const m = session.metadata ?? {};
    const email = (session.customer_details?.email ?? session.customer_email ?? "").trim();

    if (m.trial_entitlement === "true") {
      const student = {
        fullName: typeof m.full_name === "string" ? m.full_name : "",
        furigana: typeof m.furigana === "string" ? m.furigana : "",
        email,
        koreanLevel: typeof m.korean_level === "string" ? m.korean_level : "",
        startDate: typeof m.start_date === "string" ? m.start_date : "",
        startDateLabel: typeof m.start_date_label === "string" ? m.start_date_label : "",
        inquiry: typeof m.inquiry === "string" && m.inquiry.trim() ? m.inquiry.trim() : undefined,
      };

      console.info("payment_result_trial_entitlement", {
        sessionId,
        trialFlow: "entitlement",
      });

      return json(
        {
          ok: true,
          trialFlow: "entitlement" as const,
          isPaid,
          paymentStatus: session.payment_status,
          checkoutStatus: session.status,
          student,
          payment: {
            amountTotal: session.amount_total,
            currency: session.currency,
            methodLabel: "Credit Card",
            statusLabel: isPaid ? "Active" : "Pending",
          },
        },
        200
      );
    }

    if (m.trial_lesson !== "true") {
      return json({ error: "not_trial_checkout" }, 400);
    }

    const student = {
      fullName: typeof m.full_name === "string" ? m.full_name : "",
      furigana: typeof m.furigana === "string" ? m.furigana : "",
      email,
      koreanLevel: typeof m.korean_level === "string" ? m.korean_level : "",
      startDate: typeof m.start_date === "string" ? m.start_date : "",
      startDateLabel: typeof m.start_date_label === "string" ? m.start_date_label : "",
      inquiry: typeof m.inquiry === "string" && m.inquiry.trim() ? m.inquiry.trim() : undefined,
    };

    console.info("payment_result_trial_lesson", { sessionId, trialFlow: "trial_lesson" });

    return json(
      {
        ok: true,
        trialFlow: "trial_lesson" as const,
        isPaid,
        paymentStatus: session.payment_status,
        checkoutStatus: session.status,
        student,
        payment: {
          amountTotal: session.amount_total,
          currency: session.currency,
          methodLabel: "Credit Card",
          statusLabel: isPaid ? "Active" : "Pending",
        },
      },
      200
    );
  } catch (e) {
    console.error("payment_result_retrieve_error", e);
    return json({ error: "retrieve_failed" }, 500);
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const host = req.headers.host ?? "localhost";
  const pathWithQuery = req.url ?? "/api/writing/trial-payment/payment-result";
  const url = `https://${host}${pathWithQuery}`;

  try {
    const webRequest = new Request(url, {
      method: "GET",
      headers: req.headers as HeadersInit,
    });
    const response = await handleTrialPaymentResultGet(webRequest);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("trial_payment_result_vercel_unhandled", { message });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
