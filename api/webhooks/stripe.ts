/**
 * Vercel Serverless — `vite build` では Next `app/api` がデプロイされないため、
 * このファイルで `/api/webhooks/stripe` を提供する。
 */
import { handleWritingStripeWebhookPost } from "../../server/services/writingStripeWebhook";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function stripeWebhookHandler(req: Request): Promise<Response> {
  try {
    return await handleWritingStripeWebhookPost(req);
  } catch (e) {
    console.error("writing_stripe_webhook_unhandled", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
