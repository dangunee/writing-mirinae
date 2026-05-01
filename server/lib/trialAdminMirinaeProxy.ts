/**
 * Proxies trial-application admin list/mutations to mirinae-api (server-side secret only).
 */

import { getDb } from "../db/client";
import { assertTrialResendAllowed } from "../services/trialApplicationsAdminService";
import { reopenMissedTrialSessionsAfterExtend } from "../services/trialExtendSessionReopenService";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function logUpstreamBody(raw: string): string {
  const max = 4000;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

export function mirinaeTrialAdminBaseAndSecret(): { base: string; secret: string } | null {
  const base = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
  const secret = process.env.TRIAL_ADMIN_SECRET?.trim() ?? "";
  if (!base || !secret) {
    return null;
  }
  return { base: base.replace(/\/$/, ""), secret };
}

export async function proxyTrialApplicationsList(req: Request): Promise<Response> {
  const cfg = mirinaeTrialAdminBaseAndSecret();
  if (!cfg) {
    return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
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
    console.error("trial_admin_list_fetch_error", e);
    return new Response(JSON.stringify({ ok: false, error: "upstream_error" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

export async function proxyTrialApplicationExtensionLogs(applicationId: string): Promise<Response> {
  const cfg = mirinaeTrialAdminBaseAndSecret();
  if (!cfg) {
    return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const url = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/extension-logs`;
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
    console.error("trial_admin_extension_logs_fetch_error", e);
    return new Response(JSON.stringify({ ok: false, error: "upstream_error" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

export type TrialAdminOp = "activate" | "resend" | "extend";

export function trialAdminOpFromRequest(req: Request): TrialAdminOp {
  try {
    const u = new URL(req.url);
    const q = u.searchParams.get("__trial_admin_op")?.trim();
    if (q === "extend") return "extend";
    if (q === "resend") return "resend";
    if (q === "activate") return "activate";
    const p = u.pathname;
    if (p.endsWith("/extend-access")) return "extend";
    if (p.endsWith("/resend-access")) return "resend";
  } catch {
    /* fall through */
  }
  return "activate";
}

async function handleActivateUpstream(req: Request, applicationId: string): Promise<Response> {
  const cfg = mirinaeTrialAdminBaseAndSecret();
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

  const bodyLen = body?.length ?? 0;
  console.info("[trial admin bff] activate start", { applicationId, bodyLength: bodyLen });

  const upstreamUrl = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/activate`;
  try {
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        "Content-Type": "application/json",
      },
      body: body ?? "{}",
    });
    const text = await res.text();
    console.info("[trial admin bff] activate upstream status", res.status);
    console.info("[trial admin bff] activate upstream raw", logUpstreamBody(text));

    let outText = text;
    const st = res.status;
    if (st >= 400 && !text.trim()) {
      outText = JSON.stringify({ ok: false, error: `upstream_${st}` });
    } else if (st >= 400) {
      try {
        const parsed = JSON.parse(text) as { ok?: boolean; error?: string };
        if (parsed && typeof parsed === "object" && parsed.ok === false && typeof parsed.error !== "string") {
          outText = JSON.stringify({ ...parsed, ok: false, error: `upstream_${st}` });
        }
      } catch {
        outText = JSON.stringify({ ok: false, error: `upstream_${st}`, detail: "non_json_upstream" });
      }
    }

    return new Response(outText, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("[trial admin bff] activate fetch error", e);
    return new Response(JSON.stringify({ ok: false, error: "upstream_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

async function handleResendUpstream(_req: Request, applicationId: string): Promise<Response> {
  const cfg = mirinaeTrialAdminBaseAndSecret();
  if (!cfg) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const upstreamUrl = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/resend-access`;
  try {
    const res = await fetch(upstreamUrl, {
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

async function handleExtendUpstream(
  req: Request,
  applicationId: string,
  opts?: { actorUserId?: string }
): Promise<Response> {
  const cfg = mirinaeTrialAdminBaseAndSecret();
  if (!cfg) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  let bodyText = "{}";
  try {
    bodyText = await req.text();
  } catch {
    bodyText = "{}";
  }

  let requestedExpiry: Date | null = null;
  try {
    const jb = JSON.parse(bodyText || "{}") as Record<string, unknown>;
    const iso =
      typeof jb.accessExpiresAt === "string"
        ? jb.accessExpiresAt
        : typeof jb.access_expires_at === "string"
          ? jb.access_expires_at
          : typeof jb.newAccessExpiresAt === "string"
            ? jb.newAccessExpiresAt
            : null;
    if (iso?.trim()) {
      const d = new Date(iso.trim());
      if (!Number.isNaN(d.getTime())) requestedExpiry = d;
    }
  } catch {
    /* ignore */
  }

  const upstreamUrl = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/extend-access`;
  const idem = req.headers.get("x-idempotency-key")?.trim();
  try {
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        "Content-Type": "application/json",
        ...(idem ? { "X-Idempotency-Key": idem } : {}),
      },
      body: bodyText || "{}",
    });
    const text = await res.text();

    if (res.ok && opts?.actorUserId) {
      try {
        const db = getDb();
        await reopenMissedTrialSessionsAfterExtend(db, {
          applicationId,
          actorUserId: opts.actorUserId,
          accessExpiresAt: requestedExpiry,
          upstreamExtendResponseBody: text,
        });
      } catch (e) {
        console.error("trial_extend_reopen_failed", {
          applicationIdPrefix: applicationId.slice(0, 8),
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
      }
    }

    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("trial_admin_bff_extend_fetch_error", e);
    return json({ ok: false, error: "upstream_error" }, 502);
  }
}

/** POST mutations (activate / extend / resend) — caller must enforce requireAdminSessionUserId. */
export async function proxyTrialAdminMutation(
  req: Request,
  applicationId: string,
  opts?: { actorUserId?: string }
): Promise<Response> {
  const id = applicationId.trim();
  if (!id) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const op = trialAdminOpFromRequest(req);
  switch (op) {
    case "extend":
      return handleExtendUpstream(req, id, opts);
    case "resend": {
      const db = getDb();
      const gate = await assertTrialResendAllowed(db, id);
      if (!gate.ok && gate.code === "not_found") {
        return json({ ok: false, error: "not_found" }, 404);
      }
      if (!gate.ok) {
        return json({ ok: false, error: "expired_access" }, 409);
      }
      return handleResendUpstream(req, id);
    }
    default:
      return handleActivateUpstream(req, id);
  }
}
