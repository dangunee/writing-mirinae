import { sendTrialLessonBankTransferEmails } from "./trialLessonBankTransferEmails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BankTransferNotifyResult =
  | { ok: true; status: 200; json: { ok: true; applicationId?: string } }
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

  const inquiryParts = [
    inquiry,
    `開始日: ${startDateLabel} (${startDate})`,
    furigana ? `ふりがな: ${furigana}` : null,
  ].filter(Boolean) as string[];
  const inquiryCombined = inquiryParts.join("\n\n");

  const mirinaeBase = process.env.MIRINAE_API_BASE_URL?.trim();
  let applicationId: string | undefined;
  if (mirinaeBase) {
    const target = `${mirinaeBase.replace(/\/$/, "")}/api/trial/applications`;
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          koreanLevel,
          inquiry: inquiryCombined || undefined,
          paymentMethod: "bank_transfer",
          startDate,
          startDateLabel,
          furigana,
        }),
      });
      const text = await res.text();
      let parsed: { ok?: boolean; applicationId?: string } = {};
      try {
        parsed = text ? (JSON.parse(text) as typeof parsed) : {};
      } catch {
        return { ok: false, status: 502, json: { error: "upstream_invalid_json" } };
      }
      if (!res.ok || parsed.ok !== true || typeof parsed.applicationId !== "string") {
        console.error("bank_transfer_trial_application_failed", { status: res.status, body: text.slice(0, 400) });
        return { ok: false, status: res.status >= 400 && res.status < 600 ? res.status : 502, json: { error: "application_create_failed" } };
      }
      applicationId = parsed.applicationId;
      console.info("bank_transfer_notify_trial_application", {
        applicationId,
        applicantEmail: email,
        source: "writing_mirinae_edge",
      });
    } catch (e) {
      console.error("bank_transfer_trial_application_fetch_error", e);
      return { ok: false, status: 502, json: { error: "application_create_failed" } };
    }
  } else {
    console.warn("bank_transfer_notify_no_mirinae_api", {
      reason: "MIRINAE_API_BASE_URL missing; writing.trial_applications not created from this handler",
    });
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
  return { ok: true, status: 200, json: { ok: true, ...(applicationId ? { applicationId } : {}) } };
}
