import { handleWritingStripeWebhookPost } from "../../../../server/lib/writingStripeWebhook";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe — delegates to server/lib (single implementation; no duplicate root `api/` handler).
 */
export async function POST(req: Request) {
  console.info("writing_stripe_webhook_next_route_entry", {
    note: "delegates_to_handleWritingStripeWebhookPost",
  });
  return handleWritingStripeWebhookPost(req);
}
