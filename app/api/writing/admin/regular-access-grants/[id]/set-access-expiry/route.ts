import { handleRegularGrantSetAccessExpiry } from "../../../../../../../server/admin/regularGrantAdminPostHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/writing/admin/regular-access-grants/:id/set-access-expiry */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handleRegularGrantSetAccessExpiry(req, params.id ?? "");
}
