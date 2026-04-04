export const runtime = "nodejs";

/** GET /api/writing/admin/trial-applications — BFF → mirinae-api (self-contained for next dev) */

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function assertTrialAdminBff(req: Request): void {
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

export async function GET(req: Request) {
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

  let upstreamPath = "/api/admin/trial-applications";
  try {
    const u = new URL(req.url);
    if (u.search) upstreamPath += u.search;
  } catch {
    /* keep path only */
  }
  const url = `${cfg.base}${upstreamPath}`;
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
