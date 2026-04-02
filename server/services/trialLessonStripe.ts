import Stripe from "stripe";

import { TRIAL_LESSON_AMOUNT_JPY } from "../constants/trialLessonAmount";

export { TRIAL_LESSON_AMOUNT_JPY } from "../constants/trialLessonAmount";

const META_MAX = 500;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return new Stripe(key, { typescript: true });
}

export type CreateTrialLessonCheckoutInput = {
  successUrl: string;
  cancelUrl: string;
  startDate: string;
  startDateLabel: string;
  fullName: string;
  furigana: string;
  email: string;
  koreanLevel: string;
  inquiry?: string;
};

/**
 * Stripe Checkout Session — 体験レッスン ¥1,800 のみ（line_items はサーバー定数）
 *
 * metadata は `trial_entitlement: "true"`（webhook の trial_entitlement 分岐用）。
 * `application_id` が必要な本番フローは mirinae-api 経由の Checkout 作成を使うこと。
 */
export async function createTrialLessonCheckoutSession(
  input: CreateTrialLessonCheckoutInput
): Promise<{ url: string }> {
  const stripe = getStripeClient();

  const metadata: Record<string, string> = {
    trial_entitlement: "true",
    start_date: truncate(input.startDate, META_MAX),
    start_date_label: truncate(input.startDateLabel, META_MAX),
    full_name: truncate(input.fullName, META_MAX),
    furigana: truncate(input.furigana, META_MAX),
    korean_level: truncate(input.koreanLevel, META_MAX),
  };
  if (input.inquiry?.trim()) {
    metadata.inquiry = truncate(input.inquiry.trim(), META_MAX);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: TRIAL_LESSON_AMOUNT_JPY,
          product_data: {
            name: "体験レッスン",
            description: "ミリネ韓国語教室　作文トレーニング",
          },
        },
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.email.trim(),
    metadata,
    payment_intent_data: {
      metadata: {
        trial_entitlement: "true",
      },
    },
  });

  if (!session.url) {
    throw new Error("stripe_no_checkout_url");
  }

  return { url: session.url };
}
