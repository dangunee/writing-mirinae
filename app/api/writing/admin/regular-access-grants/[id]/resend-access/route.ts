import { handleRegularGrantResendAccess } from "../../../../../../../server/admin/regularGrantAdminPostHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/writing/admin/regular-access-grants/:id/resend-access */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handleRegularGrantResendAccess(req, params.id ?? "");
}
