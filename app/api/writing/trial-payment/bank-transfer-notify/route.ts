import { NextResponse } from "next/server";

import { handleBankTransferNotifyPostJson } from "../../../../../server/services/trialPaymentBankTransferNotifyHandler";

export const runtime = "nodejs";

/**
 * POST /api/writing/trial-payment/bank-transfer-notify
 * 銀行振込申込 — Resend で管理先・申込者へ通知（金額はサーバー固定 ¥1,800 のみ）。
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
