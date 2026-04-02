import { handleTrialApplicationActivatePost } from "../../../../../../../server/lib/trialAdminBff";

export const runtime = "nodejs";

/** POST /api/writing/admin/trial-applications/:id/activate */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handleTrialApplicationActivatePost(req, params.id ?? "");
}
