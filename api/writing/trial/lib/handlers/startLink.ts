import type { IncomingMessage, ServerResponse } from "http";

import { proxyPostJsonToUpstream } from "../services/trialService.js";

export async function handleStartLink(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await proxyPostJsonToUpstream(req, res, "/api/writing/trial/start-link", "trial_start_link");
}
