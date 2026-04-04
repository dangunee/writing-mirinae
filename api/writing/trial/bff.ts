/**
 * Vercel — trial BFF 単一 Serverless Function（実装は server/writing-trial-bff/*）
 *
 * 実装を api/ 配下に置かないこと（Vercel Hobby は Serverless 関数 12 個まで。
 * api 配下の各 .ts が 1 関数として数えられるため）。
 * 相対 import は `.js` で ESM 解決を明示。
 *
 * vercel.json rewrite（外部 URL 不変）:
 * - /api/writing/trial/session/current → ?op=session_current
 * - /api/writing/trial/access/consume → ?op=access_consume
 * - /api/writing/trial/start-link → ?op=start_link
 * - /api/writing/trial/reissue-link → ?op=reissue_link
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleAccessConsume } from "../../../server/writing-trial-bff/handlers/consume.js";
import { handleReissueLink } from "../../../server/writing-trial-bff/handlers/reissueLink.js";
import { handleSessionCurrent } from "../../../server/writing-trial-bff/handlers/sessionCurrent.js";
import { handleStartLink } from "../../../server/writing-trial-bff/handlers/startLink.js";
import { parseTrialBffOp } from "../../../server/writing-trial-bff/utils/validation.js";

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
