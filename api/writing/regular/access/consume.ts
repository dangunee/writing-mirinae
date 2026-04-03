/**
 * Vercel — POST /api/writing/regular/access/consume
 * Proxies to mirinae-api; sets httpOnly cookie from JSON body.
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "INVALID_TOKEN" }));
    return;
  }

  const base = mirinaeBase();
  if (!base) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "INVALID_TOKEN" }));
    return;
  }

  let bodyBuf: Buffer;
  try {
    bodyBuf = await readRawBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "INVALID_TOKEN" }));
    return;
  }

  try {
    const upstream = await fetch(`${base}/api/writing/regular/access/consume`, {
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
      code?: string;
    } = {};
    try {
      json = text ? (JSON.parse(text) as typeof json) : {};
    } catch {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, code: "INVALID_TOKEN" }));
      return;
    }

    if (!json.ok) {
      console.warn("regular_access_consume_bff_fail", { upstreamStatus: upstream.status, code: json.code });
      res.statusCode = upstream.status >= 400 ? upstream.status : 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, code: json.code ?? "INVALID_TOKEN" }));
      return;
    }

    const redirectTo = typeof json.redirectTo === "string" ? json.redirectTo.trim() : "";
    const sessionCookie = typeof json.sessionCookie === "string" ? json.sessionCookie.trim() : "";
    if (!redirectTo || !sessionCookie) {
      console.warn("regular_access_consume_bff_fail", { reason: "upstream_missing_fields" });
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, code: "INVALID_TOKEN" }));
      return;
    }

    const secure = process.env.NODE_ENV === "production";
    const maxAge =
      typeof json.sessionCookieMaxAgeSec === "number" && Number.isFinite(json.sessionCookieMaxAgeSec)
        ? Math.max(0, Math.floor(json.sessionCookieMaxAgeSec))
        : COOKIE_MAX_AGE_FALLBACK;
    const cookieParts = [
      `writing_regular_access=${encodeURIComponent(sessionCookie)}`,
      "Path=/writing",
      `Max-Age=${maxAge}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (secure) cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    console.info("regular_access_consume_bff_ok", { secureCookie: secure });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, redirectTo }));
  } catch (e) {
    console.error("regular_access_consume_bff_error", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "INVALID_TOKEN" }));
  }
}
