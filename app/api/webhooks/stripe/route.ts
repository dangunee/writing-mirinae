import { handleWritingStripeWebhookPost } from "../../../../server/services/writingStripeWebhook";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe
 * 本番 Vercel では `api/webhooks/stripe.ts` が実体。`next dev` や将来 Next 単体ビルド用に残す。
 */
export async function POST(req: Request) {
  console.info("writing_stripe_webhook_next_route_entry", {
    note: "delegates_to_handleWritingStripeWebhookPost",
  });
  return handleWritingStripeWebhookPost(req);
}
