import { sendTrialLessonBankTransferEmails } from "./trialLessonBankTransferEmails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BankTransferNotifyResult =
  | { ok: true; status: 200; json: { ok: true } }
  | { ok: false; status: number; json: { error: string } };

/**
 * POST ボディ検証 + Resend（Next Route / Vercel Serverless 共通）
 */
export async function handleBankTransferNotifyPostJson(
  body: Record<string, unknown>
): Promise<BankTransferNotifyResult> {
  if (
    "price" in body ||
    "amount" in body ||
    "total" in body ||
    "currency" in body ||
    "unit_amount" in body ||
    "line_items" in body
  ) {
    return { ok: false, status: 400, json: { error: "forbidden_fields" } };
  }

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const startDateLabel = typeof body.startDateLabel === "string" ? body.startDateLabel.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const furigana = typeof body.furigana === "string" ? body.furigana.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const koreanLevel = typeof body.koreanLevel === "string" ? body.koreanLevel.trim() : "";
  const inquiry = typeof body.inquiry === "string" ? body.inquiry.trim() : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, status: 400, json: { error: "invalid_start_date" } };
  }
  if (!fullName || fullName.length > 200) {
    return { ok: false, status: 400, json: { error: "invalid_full_name" } };
  }
  if (!furigana || furigana.length > 200) {
    return { ok: false, status: 400, json: { error: "invalid_furigana" } };
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false, status: 400, json: { error: "invalid_email" } };
  }
  if (!koreanLevel || koreanLevel.length > 200) {
    return { ok: false, status: 400, json: { error: "invalid_korean_level" } };
  }
  if (!startDateLabel || startDateLabel.length > 200) {
    return { ok: false, status: 400, json: { error: "invalid_start_date_label" } };
  }
  if (inquiry && inquiry.length > 2000) {
    return { ok: false, status: 400, json: { error: "invalid_inquiry" } };
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
  return { ok: true, status: 200, json: { ok: true } };
}
