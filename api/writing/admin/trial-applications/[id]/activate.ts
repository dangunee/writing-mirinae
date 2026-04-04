/**
 * Vercel Serverless — trial admin by application id（単一 Function）
 *
 * 外部 URL（フロントは変更なし）:
 * - POST .../activate
 * - POST .../resend-access  → rewrite で本ハンドラへ
 * - POST .../extend-access → rewrite で本ハンドラへ
 *
 * mirinae-api upstream は従来どおり /api/admin/trial-applications/:id/{activate|resend-access|extend-access}
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

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

function logUpstreamBody(raw: string): string {
  const max = 4000;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

type AdminOp = "activate" | "resend" | "extend";

function adminOpFromRequest(req: Request): AdminOp {
  try {
    const u = new URL(req.url);
    const q = u.searchParams.get("__trial_admin_op")?.trim();
    if (q === "extend") return "extend";
    if (q === "resend") return "resend";
    const p = u.pathname;
    if (p.endsWith("/extend-access")) return "extend";
    if (p.endsWith("/resend-access")) return "resend";
  } catch {
    /* fall through */
  }
  return "activate";
}

async function handleActivateUpstream(req: Request, applicationId: string): Promise<Response> {
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
  const cfg = mirinaeBaseAndSecret();
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

async function handleExtendUpstream(req: Request, applicationId: string): Promise<Response> {
  const cfg = mirinaeBaseAndSecret();
  if (!cfg) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  let bodyText = "{}";
  try {
    bodyText = await req.text();
  } catch {
    bodyText = "{}";
  }

  const upstreamUrl = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/extend-access`;
  try {
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        "Content-Type": "application/json",
      },
      body: bodyText || "{}",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("trial_admin_bff_extend_fetch_error", e);
    return json({ ok: false, error: "upstream_error" }, 502);
  }
}

async function handleTrialAdminByIdPost(req: Request, id: string): Promise<Response> {
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

  const op = adminOpFromRequest(req);
  if (op === "extend") {
    return handleExtendUpstream(req, applicationId);
  }
  if (op === "resend") {
    return handleResendUpstream(req, applicationId);
  }
  return handleActivateUpstream(req, applicationId);
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * vercel.json の rewrite で .../activate?__trial_admin_op=... になる場合と、
 * 開発環境などで .../extend-access | .../resend-access のまま届く場合の両方から id を取る。
 */
function extractId(req: IncomingMessage): string {
  const u = req.url ?? "";
  const m = u.match(
    /\/trial-applications\/([^/]+)\/(?:activate|extend-access|resend-access)(?:\?|$)/
  );
  return m?.[1]?.trim() ?? "";
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  const id = extractId(req);
  const host = req.headers.host ?? "localhost";
  const path = req.url?.split("?")[0] ?? `/api/writing/admin/trial-applications/${id}/activate`;
  const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
  const url = `https://${host}${path}${search}`;

  try {
    const rawBody = await readRawBody(req);
    const webRequest = new Request(url, {
      method: "POST",
      headers: req.headers as HeadersInit,
      body: rawBody.length > 0 ? rawBody : "{}",
    });
    const response = await handleTrialAdminByIdPost(webRequest, id);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    console.error("trial_admin_by_id_vercel_unhandled", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
}
