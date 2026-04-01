/**
 * Vercel Serverless（静的 Vite デプロイ時も /api が動くように配置）
 * Next の app/api と同じパス・同じ処理。
 */
import { handleBankTransferNotifyPostJson } from "../../../server/services/trialPaymentBankTransferNotifyHandler";

type VercelStyleRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

export default async function handler(
  req: { method?: string; body?: unknown },
  res: VercelStyleRes
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  let body: Record<string, unknown>;
  try {
    const raw = req.body;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      body = raw as Record<string, unknown>;
    } else if (typeof raw === "string") {
      body = JSON.parse(raw) as Record<string, unknown>;
    } else {
      res.status(400).json({ error: "invalid_json" });
      return;
    }
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
