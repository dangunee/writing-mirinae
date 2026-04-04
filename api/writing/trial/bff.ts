/**
 * Vercel — trial BFF 単一 Serverless Function（処理は api/writing/trial/lib/* に同梱）
 *
 * 注意: ディレクトリ名は `_lib` ではなく `lib`（Vercel/Node ESM で `_` 配下が含まれない事例を避ける）。
 * 相対 import は `.js` 拡張子で ESM 解決を明示（Linux/Vercel）。
 *
 * vercel.json rewrite（外部 URL 不変）:
 * - /api/writing/trial/session/current → ?op=session_current
 * - /api/writing/trial/access/consume → ?op=access_consume
 * - /api/writing/trial/start-link → ?op=start_link
 * - /api/writing/trial/reissue-link → ?op=reissue_link
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleAccessConsume } from "./lib/handlers/consume.js";
import { handleReissueLink } from "./lib/handlers/reissueLink.js";
import { handleSessionCurrent } from "./lib/handlers/sessionCurrent.js";
import { handleStartLink } from "./lib/handlers/startLink.js";
import { parseTrialBffOp } from "./lib/utils/validation.js";

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
