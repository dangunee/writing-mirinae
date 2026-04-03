import { handleRegularGrantUnifiedPost } from "../../../../../../server/admin/regularGrantAdminPostHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/writing/admin/regular-access-grants/:id — body.action: set_enabled | set_expiry | resend_access; id=dev-seed for dev seed proxy */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handleRegularGrantUnifiedPost(req, params.id ?? "");
}
