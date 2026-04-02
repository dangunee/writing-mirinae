import { handleTrialCreateCheckoutSessionRequest } from "../../../../../api/_lib/trialCreateCheckoutSessionHandler";

export const runtime = "nodejs";

/**
 * POST /api/writing/trial-payment/create-checkout-session
 * 本番 Vercel では `api/writing/trial-payment/create-checkout-session.ts` が実体（Vite のみビルド時）。
 */
export async function POST(req: Request) {
  return handleTrialCreateCheckoutSessionRequest(req);
}
