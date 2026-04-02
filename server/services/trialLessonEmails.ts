import type { Stripe } from "stripe";

import { TRIAL_LESSON_AMOUNT_JPY } from "../constants/trialLessonAmount";

function siteBaseUrl(): string {
  const u = process.env.SITE_URL?.trim() || "https://writing-mirinae.vercel.app";
  return u.replace(/\/$/, "");
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * Resend REST API — RESEND_API_KEY が無い場合はスキップ（ログのみ）
 */
export async function sendTrialLessonEmailsFromStripeSession(session: Stripe.Checkout.Session): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const adminTo = process.env.TRIAL_LESSON_ADMIN_EMAIL?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Writing <onboarding@resend.dev>";

  const meta = session.metadata ?? {};
  const fullName = meta.full_name ?? "";
  const furigana = meta.furigana ?? "";
  const email = (session.customer_details?.email ?? session.customer_email ?? "").trim();
  const koreanLevel = meta.korean_level ?? "";
  const startDate = meta.start_date ?? "";
  const startDateLabel = meta.start_date_label ?? "";
  const inquiry = meta.inquiry?.trim() ?? "";

  if (!apiKey) {
    console.warn("trial_lesson_email_skipped", { reason: "RESEND_API_KEY missing" });
    return;
  }

  const adminSubject = `[体験レッスン] 決済完了 ${fullName || email || session.id}`;
  const adminText = [
    "体験レッスンの決済が完了しました。",
    "",
    `Stripe Session: ${session.id}`,
    `金額: ${TRIAL_LESSON_AMOUNT_JPY} JPY`,
    `タイプ: trial lesson`,
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

  const base = siteBaseUrl();
  const studentSubject = "【ミリネ韓国語教室】体験レッスンのお申し込みが完了しました";
  const studentText = [
    `${fullName || "お客様"} 様`,
    "",
    "このたびは、ミリネ韓国語教室 作文トレーニング体験レッスンに",
    "お申し込みいただき、ありがとうございます。",
    "",
    "お支払いの確認が完了しました。",
    "下記リンクより、すぐに課題作成を開始していただけます。",
    "",
    "課題開始:",
    `${base}/writing/app`,
    "",
    "※ お支払い完了後の返金はできませんので、あらかじめご了承ください。",
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
      console.error("trial_lesson_admin_email_failed", e);
    }
  } else {
    console.warn("trial_lesson_admin_email_skipped", { reason: "TRIAL_LESSON_ADMIN_EMAIL missing" });
  }

  if (email) {
    try {
      await send(email, studentSubject, studentText);
    } catch (e) {
      console.error("trial_lesson_student_email_failed", e);
    }
  }
}
