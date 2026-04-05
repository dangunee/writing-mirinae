/**
 * Password reset email via Resend (same stack as trial emails).
 */

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Writing <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("password_reset_email_skipped", { reason: "RESEND_API_KEY missing" });
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
      subject: "【ミリネ韓国語教室】パスワード再設定",
      text: [
        "パスワード再設定のご依頼を受け付けました。",
        "",
        "下記のリンクは15分間のみ有効です。",
        "",
        params.resetUrl,
        "",
        "心当たりがない場合は、このメールを無視してください。",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    console.error("password_reset_email_failed", await res.text());
    return false;
  }
  return true;
}
