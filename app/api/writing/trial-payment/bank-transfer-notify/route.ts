import { NextResponse } from "next/server";

import { sendTrialLessonBankTransferEmails } from "../../../../../server/services/trialLessonEmails";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (
    "price" in body ||
    "amount" in body ||
    "total" in body ||
    "currency" in body ||
    "unit_amount" in body ||
    "line_items" in body
  ) {
    return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
  }

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const startDateLabel = typeof body.startDateLabel === "string" ? body.startDateLabel.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const furigana = typeof body.furigana === "string" ? body.furigana.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const koreanLevel = typeof body.koreanLevel === "string" ? body.koreanLevel.trim() : "";
  const inquiry = typeof body.inquiry === "string" ? body.inquiry.trim() : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "invalid_start_date" }, { status: 400 });
  }
  if (!fullName || fullName.length > 200) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }
  if (!furigana || furigana.length > 200) {
    return NextResponse.json({ error: "invalid_furigana" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!koreanLevel || koreanLevel.length > 200) {
    return NextResponse.json({ error: "invalid_korean_level" }, { status: 400 });
  }
  if (!startDateLabel || startDateLabel.length > 200) {
    return NextResponse.json({ error: "invalid_start_date_label" }, { status: 400 });
  }
  if (inquiry && inquiry.length > 2000) {
    return NextResponse.json({ error: "invalid_inquiry" }, { status: 400 });
  }

  await sendTrialLessonBankTransferEmails({
    fullName,
    furigana,
    email,
    koreanLevel,
    startDate,
    startDateLabel,
    inquiry: inquiry || undefined,
  });
  return NextResponse.json({ ok: true });
}
