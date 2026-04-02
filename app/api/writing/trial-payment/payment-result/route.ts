import { handleTrialPaymentResultGet } from "../../../../../api/_lib/trialPaymentResultHandler";

export const runtime = "nodejs";

/**
 * GET /api/writing/trial-payment/payment-result?session_id=cs_...
 */
export async function GET(req: Request) {
  return handleTrialPaymentResultGet(req);
}
