/**
 * Vercel Serverless — ルート直下の api/ のみ確実にルーティングされる（ネスト api/writing/... は環境によって 404 になり得る）
 */
import { readJsonObjectFromVercelRequest } from "../server/lib/vercelReadJsonBody";
import { handleBankTransferNotifyPostJson } from "../server/services/trialPaymentBankTransferNotifyHandler";

type VercelStyleRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

export default async function handler(
  req: { method?: string; body?: unknown } & import("http").IncomingMessage,
  res: VercelStyleRes
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectFromVercelRequest(req);
  } catch {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  const result = await handleBankTransferNotifyPostJson(body);
  if (!result.ok) {
    res.status(result.status).json(result.json);
    return;
  }
  res.status(result.status).json(result.json);
}
