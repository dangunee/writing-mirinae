/**
 * BFF: ブラウザは TRIAL_ADMIN_SECRET を知らない。
 * TRIAL_ADMIN_BFF_TOKEN で BFF を通し、サーバーが MIRINAE_API_BASE_URL + TRIAL_ADMIN_SECRET で mirinae-api を呼ぶ。
 *
 * 配置: api/writing/admin/_lib/ — 同一 admin ツリー内の route から相対 import（Vercel bundle に含める）
 */

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function assertTrialAdminBff(req: Request): void {
  const expected = process.env.TRIAL_ADMIN_BFF_TOKEN?.trim();
  if (!expected) {
    throw new Error("bff_misconfigured");
  }
  const h = req.headers.get("authorization")?.trim() ?? "";
  const bearer = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
  if (bearer !== expected) {
    throw new Error("unauthorized");
  }
}

function mirinaeBaseAndSecret(): { base: string; secret: string } | null {
  const base = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
  const secret = process.env.TRIAL_ADMIN_SECRET?.trim() ?? "";
  if (!base || !secret) {
    return null;
  }
  return { base: base.replace(/\/$/, ""), secret };
}

export async function handleTrialApplicationsListGet(req: Request): Promise<Response> {
  try {
    assertTrialAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "request_failed" }, 401);
  }

  const cfg = mirinaeBaseAndSecret();
  if (!cfg) {
    console.error("trial_admin_bff_missing_env", {
      hasMirinaeApiBaseUrl: Boolean(process.env.MIRINAE_API_BASE_URL?.trim()),
      hasTrialAdminSecret: Boolean(process.env.TRIAL_ADMIN_SECRET?.trim()),
    });
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const url = `${cfg.base}/api/admin/trial-applications`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.secret}` },
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("trial_admin_bff_list_fetch_error", e);
    return json({ ok: false, error: "upstream_error" }, 502);
  }
}

export async function handleTrialApplicationActivatePost(req: Request, id: string): Promise<Response> {
  try {
    assertTrialAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "request_failed" }, 401);
  }

  const applicationId = id?.trim() ?? "";
  if (!applicationId) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const cfg = mirinaeBaseAndSecret();
  if (!cfg) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  let body: string | undefined;
  try {
    const raw = await req.text();
    body = raw || undefined;
  } catch {
    body = undefined;
  }

  const url = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/activate`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        "Content-Type": "application/json",
      },
      body: body ?? "{}",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("trial_admin_bff_activate_fetch_error", e);
    return json({ ok: false, error: "upstream_error" }, 502);
  }
}

export async function handleTrialApplicationResendPost(req: Request, id: string): Promise<Response> {
  try {
    assertTrialAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "request_failed" }, 401);
  }

  const applicationId = id?.trim() ?? "";
  if (!applicationId) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const cfg = mirinaeBaseAndSecret();
  if (!cfg) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const url = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/resend-access`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.secret}` },
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("trial_admin_bff_resend_fetch_error", e);
    return json({ ok: false, error: "upstream_error" }, 502);
  }
}
