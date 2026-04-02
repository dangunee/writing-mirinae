import { handleTrialApplicationsListGet } from "../../../../../api/writing/admin/_lib/trialAdminBff";

export const runtime = "nodejs";

/** GET /api/writing/admin/trial-applications — BFF → mirinae-api */
export async function GET(req: Request) {
  return handleTrialApplicationsListGet(req);
}
