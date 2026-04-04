/**
 * Vercel — trial BFF 単一 Serverless Function（処理は api/writing/trial/_lib/* に同梱）
 *
 * vercel.json rewrite（外部 URL 不変）:
 * - /api/writing/trial/session/current → ?op=session_current
 * - /api/writing/trial/access/consume → ?op=access_consume
 * - /api/writing/trial/start-link → ?op=start_link
 * - /api/writing/trial/reissue-link → ?op=reissue_link
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleAccessConsume } from "./_lib/handlers/consume";
import { handleReissueLink } from "./_lib/handlers/reissueLink";
import { handleSessionCurrent } from "./_lib/handlers/sessionCurrent";
import { handleStartLink } from "./_lib/handlers/startLink";
import { parseTrialBffOp } from "./_lib/utils/validation";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const op = parseTrialBffOp(req);

  switch (op) {
    case "session_current":
      await handleSessionCurrent(req, res);
      return;
    case "access_consume":
      await handleAccessConsume(req, res);
      return;
    case "start_link":
      await handleStartLink(req, res);
      return;
    case "reissue_link":
      await handleReissueLink(req, res);
      return;
    default:
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "invalid_request" }));
  }
}
