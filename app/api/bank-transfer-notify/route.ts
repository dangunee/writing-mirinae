import { NextResponse } from "next/server";

import { handleBankTransferNotifyPostJson } from "../../../server/services/trialPaymentBankTransferNotifyHandler";

export const runtime = "nodejs";

/**
 * POST /api/bank-transfer-notify — next dev（Vite proxy → :3000）用
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await handleBankTransferNotifyPostJson(body);
  if (!result.ok) {
    return NextResponse.json(result.json, { status: result.status });
  }
  return NextResponse.json(result.json, { status: result.status });
}
