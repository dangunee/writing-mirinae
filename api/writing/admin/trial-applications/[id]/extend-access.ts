/**
 * Vercel Serverless — POST /api/writing/admin/trial-applications/:id/extend-access
 * Body: { days: number }
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

async function handleExtendPost(req: Request, id: string): Promise<Response> {
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

function extractId(req: IncomingMessage): string {
  const u = req.url ?? "";
  const m = u.match(/\/trial-applications\/([^/]+)\/extend-access(?:\?|$)/);
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
  const path = req.url?.split("?")[0] ?? `/api/writing/admin/trial-applications/${id}/extend-access`;
  const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
  const url = `https://${host}${path}${search}`;

  try {
    const rawBody = await readRawBody(req);
    const webRequest = new Request(url, {
      method: "POST",
      headers: req.headers as HeadersInit,
      body: rawBody.length > 0 ? rawBody : "{}",
    });
    const response = await handleExtendPost(webRequest, id);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    console.error("trial_admin_extend_vercel_unhandled", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
}
