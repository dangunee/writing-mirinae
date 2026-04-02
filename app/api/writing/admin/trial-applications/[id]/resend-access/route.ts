import { handleTrialApplicationResendPost } from "../../../../../../../server/lib/trialAdminBff";

export const runtime = "nodejs";

/** POST /api/writing/admin/trial-applications/:id/resend-access */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handleTrialApplicationResendPost(req, params.id ?? "");
}
