import { NextResponse } from "next/server";

import { getStripeClient, TRIAL_LESSON_AMOUNT_JPY } from "../../../../../server/services/trialLessonStripe";

export const runtime = "nodejs";

/**
 * GET /api/writing/trial-payment/payment-result?session_id=cs_...
 * Stripe Checkout Session を読み取り専用で返す（完了ページ表示用）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.trial_lesson !== "true") {
      return NextResponse.json({ error: "not_trial_lesson" }, { status: 400 });
    }

    const currency = (session.currency ?? "").toLowerCase();
    if (currency !== "jpy") {
      return NextResponse.json({ error: "unsupported_currency" }, { status: 400 });
    }

    const amountTotal = session.amount_total;
    if (amountTotal == null || amountTotal !== TRIAL_LESSON_AMOUNT_JPY) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const isPaid = session.payment_status === "paid";

    const m = session.metadata ?? {};
    const email = (session.customer_details?.email ?? session.customer_email ?? "").trim();

    const student = {
      fullName: typeof m.full_name === "string" ? m.full_name : "",
      furigana: typeof m.furigana === "string" ? m.furigana : "",
      email,
      koreanLevel: typeof m.korean_level === "string" ? m.korean_level : "",
      startDate: typeof m.start_date === "string" ? m.start_date : "",
      startDateLabel: typeof m.start_date_label === "string" ? m.start_date_label : "",
      inquiry: typeof m.inquiry === "string" && m.inquiry.trim() ? m.inquiry.trim() : undefined,
    };

    return NextResponse.json({
      ok: true,
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
    });
  } catch (e) {
    console.error("payment_result_retrieve_error", e);
    return NextResponse.json({ error: "retrieve_failed" }, { status: 500 });
  }
}
