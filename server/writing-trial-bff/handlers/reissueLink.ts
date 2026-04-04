import type { IncomingMessage, ServerResponse } from "http";

import { proxyPostJsonToUpstream } from "../services/trialService.js";

export async function handleReissueLink(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await proxyPostJsonToUpstream(req, res, "/api/writing/trial/reissue-link", "trial_reissue_link");
}
