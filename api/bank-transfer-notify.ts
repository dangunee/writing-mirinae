/**
 * Vercel Edge — Request.json() のみ使用（Node req ストリームが空でハングする事例を回避）
 */
import { handleBankTransferNotifyPostJson } from "../server/services/trialPaymentBankTransferNotifyHandler";

export const config = {
  runtime: "edge",
};

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const result = await handleBankTransferNotifyPostJson(body);
  if (!result.ok) {
    return jsonResponse(result.status, result.json);
  }
  return jsonResponse(result.status, result.json);
}
