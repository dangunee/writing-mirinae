import type { IncomingMessage, ServerResponse } from "http";

import {
  COOKIE_MAX_AGE_FALLBACK,
  getMirinaeBase,
  readRawBody,
} from "../services/trialService.js";

const SUCCESS_REDIRECT_PATH = "/writing/app";

function maskToken(raw: string): string {
  const t = raw.trim();
  if (!t) return "(empty)";
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

export async function handleAccessConsume(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  const base = getMirinaeBase();
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
    console.warn("trial_access_consume_failure", { step: "read_body" });
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "invalid_or_expired_access" }));
    return;
  }

  let tokenMasked = "(unparsed)";
  try {
    const parsed = JSON.parse(bodyBuf.length > 0 ? bodyBuf.toString("utf8") : "{}") as { token?: unknown };
    tokenMasked = typeof parsed.token === "string" ? maskToken(parsed.token) : "(missing)";
  } catch {
    tokenMasked = "(json_error)";
  }
  console.info("trial_access_token_received", { token: tokenMasked });

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
      alreadySubmitted?: boolean;
    } = {};
    try {
      json = text ? (JSON.parse(text) as typeof json) : {};
    } catch {
      console.warn("trial_access_token_validation", {
        ok: false,
        upstreamStatus: upstream.status,
        reason: "upstream_json_parse",
      });
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "invalid_or_expired_access" }));
      return;
    }

    console.info("trial_access_token_validation", {
      ok: json.ok === true,
      upstreamStatus: upstream.status,
      error: json.error ?? null,
    });

    if (!json.ok) {
      console.warn("trial_access_consume_failure", {
        step: "upstream_reject",
        upstreamStatus: upstream.status,
        error: json.error,
      });
      res.statusCode = upstream.status >= 400 ? upstream.status : 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const payload: Record<string, unknown> = { ok: false, error: json.error ?? "invalid_or_expired_access" };
      if (json.alreadySubmitted === true) payload.alreadySubmitted = true;
      res.end(JSON.stringify(payload));
      return;
    }

    const sessionCookie = typeof json.sessionCookie === "string" ? json.sessionCookie.trim() : "";
    if (!sessionCookie) {
      console.warn("trial_access_consume_failure", { step: "missing_session_cookie", upstreamStatus: upstream.status });
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
      "Path=/",
      `Max-Age=${maxAge}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (secure) cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    const upstreamRedirect = typeof json.redirectTo === "string" ? json.redirectTo.trim() : "";
    const finalRedirectTo = SUCCESS_REDIRECT_PATH;

    console.info("trial_access_consume_success", {
      finalRedirectPath: finalRedirectTo,
      upstreamRedirectIgnored: upstreamRedirect || null,
      secureCookie: secure,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, redirectTo: finalRedirectTo }));
  } catch (e) {
    console.error("trial_access_consume_failure", { step: "exception", error: e });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "request_failed" }));
  }
}
