/**
 * Email verification (LINE onboarding / email link) via Resend.
 */

export async function sendEmailVerificationEmail(params: {
  to: string;
  verifyUrl: string;
  subject: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Writing <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("email_verification_skipped", { reason: "RESEND_API_KEY missing" });
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: [
        "メールアドレスの確認のため、下記のリンクを開いてください。",
        "",
        "このリンクは15分間のみ有効です。",
        "",
        params.verifyUrl,
        "",
        "心当たりがない場合は、このメールを無視してください。",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    console.error("email_verification_send_failed", await res.text());
    return false;
  }
  return true;
}
