/**
 * GET /api/writing/admin/trial-applications/:id/extension-logs — BFF → mirinae-api
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

function extractApplicationId(req: IncomingMessage): string {
  const u = req.url ?? "";
  const m = u.match(/\/trial-applications\/([^/]+)\/extension-logs/);
  return m?.[1]?.trim() ?? "";
}

async function handleExtensionLogsGet(req: Request, applicationId: string): Promise<Response> {
  try {
    assertTrialAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "request_failed" }, 401);
  }

  if (!applicationId) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const cfg = mirinaeBaseAndSecret();
  if (!cfg) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  const applicationId = extractApplicationId(req);
  const host = req.headers.host ?? "localhost";
  const pathOnly = req.url?.split("?")[0] ?? "";
  const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
  const url = `https://${host}${pathOnly}${search}`;

  try {
    const rawBody = await readRawBody(req);
    const webRequest = new Request(url, {
      method: "GET",
      headers: req.headers as HeadersInit,
      body: rawBody.length > 0 ? rawBody : undefined,
    });
    const response = await handleExtensionLogsGet(webRequest, applicationId);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    console.error("trial_admin_extension_logs_unhandled", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
}
