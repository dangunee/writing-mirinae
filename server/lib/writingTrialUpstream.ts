/**
 * mirinae-api で Cookie を検証し trial_application id を取得する（クライアント入力は信用しない）。
 */
export async function fetchTrialApplicationIdFromMirinaeSessionCookie(
  cookieHeader: string | null
): Promise<string | null> {
  if (!cookieHeader?.includes("writing_trial_access=")) return null;
  const base = process.env.MIRINAE_API_BASE_URL?.trim();
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/writing/trial/session/current`, {
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean; application?: { id?: string } };
    if (j?.ok === true && j.application?.id) return j.application.id;
  } catch {
    return null;
  }
  return null;
}
