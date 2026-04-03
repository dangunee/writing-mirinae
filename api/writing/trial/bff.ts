/**
 * Vercel — unified trial BFF (session/current GET + access/consume POST).
 * Rewrites from /api/writing/trial/session/current and /api/writing/trial/access/consume preserve public URLs.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

const COOKIE_MAX_AGE_FALLBACK = 7 * 24 * 60 * 60;

function mirinaeBase(): string | null {
  const base = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
  if (!base) return null;
  return base.replace(/\/$/, "");
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

function opFromUrl(req: IncomingMessage): "session_current" | "access_consume" | null {
  const u = req.url ?? "";
  const q = u.includes("?") ? u.split("?")[1] : "";
  const params = new URLSearchParams(q);
  const op = params.get("op")?.trim();
  if (op === "session_current" || op === "access_consume") return op;
  return null;
}

async function handleSessionCurrent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  const base = mirinaeBase();
  if (!base) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  const cookie = req.headers.cookie ?? "";

  try {
    const upstream = await fetch(`${base}/api/writing/trial/session/current`, {
      method: "GET",
      headers: cookie ? { Cookie: cookie } : {},
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (upstream.status >= 500) {
      console.warn("trial_session_current_bff_upstream", { status: upstream.status });
    }
    res.end(text);
  } catch (e) {
    console.error("trial_session_current_bff_error", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false }));
  }
}

async function handleAccessConsume(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  const base = mirinaeBase();
  if (!base) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "server_misconfigured" }));
    return;
  }

  let bodyBuf: Buffer;
  try {
    bodyBuf = await readRawBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "invalid_or_expired_access" }));
    return;
  }

  try {
    const upstream = await fetch(`${base}/api/writing/trial/access/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyBuf.length > 0 ? bodyBuf : "{}",
    });
    const text = await upstream.text();
    let json: {
      ok?: boolean;
      redirectTo?: string;
      sessionCookie?: string;
      sessionCookieMaxAgeSec?: number;
      error?: string;
    } = {};
    try {
      json = text ? (JSON.parse(text) as typeof json) : {};
    } catch {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "invalid_or_expired_access" }));
      return;
    }

    if (!json.ok) {
      console.warn("trial_access_consume_bff_fail", { upstreamStatus: upstream.status });
      res.statusCode = upstream.status >= 400 ? upstream.status : 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: json.error ?? "invalid_or_expired_access" }));
      return;
    }

    const redirectTo = typeof json.redirectTo === "string" ? json.redirectTo.trim() : "";
    const sessionCookie = typeof json.sessionCookie === "string" ? json.sessionCookie.trim() : "";
    if (!redirectTo || !sessionCookie) {
      console.warn("trial_access_consume_bff_fail", { reason: "upstream_missing_fields" });
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "invalid_or_expired_access" }));
      return;
    }

    const secure = process.env.NODE_ENV === "production";
    const maxAge =
      typeof json.sessionCookieMaxAgeSec === "number" && Number.isFinite(json.sessionCookieMaxAgeSec)
        ? Math.max(0, Math.floor(json.sessionCookieMaxAgeSec))
        : COOKIE_MAX_AGE_FALLBACK;
    const cookieParts = [
      `writing_trial_access=${encodeURIComponent(sessionCookie)}`,
      "Path=/writing",
      `Max-Age=${maxAge}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (secure) cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    console.info("trial_access_consume_bff_ok", { secureCookie: secure });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, redirectTo }));
  } catch (e) {
    console.error("trial_access_consume_bff_error", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "request_failed" }));
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const op = opFromUrl(req);
  if (op === "session_current") {
    await handleSessionCurrent(req, res);
    return;
  }
  if (op === "access_consume") {
    await handleAccessConsume(req, res);
    return;
  }

  res.statusCode = 400;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: false, error: "invalid_request" }));
}
