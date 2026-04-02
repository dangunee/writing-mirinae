import { TRIAL_LESSON_AMOUNT_JPY } from "../constants/trialLessonAmount";

export type TrialLessonBankTransferEmailPayload = {
  fullName: string;
  furigana: string;
  email: string;
  koreanLevel: string;
  startDate: string;
  startDateLabel: string;
  inquiry?: string;
};

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * 銀行振込申込 — 管理先・申込者へメール（Resend）。Stripe に依存しない（Edge / Vercel Functions 用）。
 */
export async function sendTrialLessonBankTransferEmails(
  payload: TrialLessonBankTransferEmailPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const adminTo = process.env.TRIAL_LESSON_ADMIN_EMAIL?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Writing <onboarding@resend.dev>";

  const { fullName, furigana, email, koreanLevel, startDate, startDateLabel, inquiry } = payload;

  if (!apiKey) {
    console.warn("trial_lesson_bank_email_skipped", { reason: "RESEND_API_KEY missing" });
    return;
  }

  const adminSubject = `[体験レッスン] 銀行振込申込 ${fullName || email}`;
  const adminText = [
    "体験レッスンの銀行振込でのお申し込みがありました（入金待ち）。",
    "",
    `タイプ: 銀行振込（入金待ち）`,
    `金額: ${TRIAL_LESSON_AMOUNT_JPY} JPY（税込・振込予定）`,
    "",
    `お名前: ${mdEscape(fullName)}`,
    `ふりがな: ${mdEscape(furigana)}`,
    `メール: ${mdEscape(email)}`,
    `韓国語レベル: ${mdEscape(koreanLevel)}`,
    `開始日(ISO): ${mdEscape(startDate)}`,
    `開始日(表示): ${mdEscape(startDateLabel)}`,
    inquiry ? `お問い合わせ: ${mdEscape(inquiry)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const studentSubject = "【ミリネ韓国語教室】体験レッスンお申し込みを受け付けました（入金待ち）";
  const studentText = [
    `${fullName || "お客様"} 様`,
    "",
    "このたびは、ミリネ韓国語教室 作文トレーニング体験レッスンに",
    "お申し込みいただき、ありがとうございます。",
    "",
    "現在のステータス: 入金待ち",
    "",
    `お振込金額: ¥${TRIAL_LESSON_AMOUNT_JPY.toLocaleString("ja-JP")}（税込）`,
    "",
    "【振込先】",
    "三井住友銀行 日暮里支店 / 普通 7961777 / （株）カオンヌリ",
    "ゆうちょ銀行 / 記号 10190 / 番号 90647671 / カ）カオンヌリ",
    "",
    "ご入金確認後、体験レッスンのご案内をメールでお送りします。",
    "確認まで1〜2営業日かかる場合があります。",
    "",
    "振込名義がお申し込み名と異なる場合は、必ずお問い合わせください。",
    "",
    "ミリネ韓国語教室",
  ].join("\n");

  const send = async (to: string, subject: string, text: string) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`resend_${res.status}: ${errText}`);
    }
  };

  if (adminTo) {
    try {
      await send(adminTo, adminSubject, adminText);
    } catch (e) {
      console.error("trial_lesson_bank_admin_email_failed", e);
    }
  } else {
    console.warn("trial_lesson_bank_admin_email_skipped", { reason: "TRIAL_LESSON_ADMIN_EMAIL missing" });
  }

  if (email) {
    try {
      await send(email, studentSubject, studentText);
    } catch (e) {
      console.error("trial_lesson_bank_student_email_failed", e);
    }
  }
}
