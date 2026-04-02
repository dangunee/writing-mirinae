/**
 * Vercel Serverless — `vite build` では Next `app/api` がデプロイされないため、
 * このファイルで `/api/webhooks/stripe` を提供する。
 */
import { handleWritingStripeWebhookPost } from "../../server/services/writingStripeWebhook";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default handleWritingStripeWebhookPost;
