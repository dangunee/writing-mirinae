/**
 * Vercel Serverless — POST /api/writing/admin/trial-applications/:id/resend-access
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleTrialApplicationResendPost } from "../../../../lib/trialAdminBff";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

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
  const m = u.match(/\/trial-applications\/([^/]+)\/resend-access(?:\?|$)/);
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
  const path = req.url?.split("?")[0] ?? `/api/writing/admin/trial-applications/${id}/resend-access`;
  const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
  const url = `https://${host}${path}${search}`;

  try {
    const rawBody = await readRawBody(req);
    const webRequest = new Request(url, {
      method: "POST",
      headers: req.headers as HeadersInit,
      body: rawBody.length > 0 ? rawBody : undefined,
    });
    const response = await handleTrialApplicationResendPost(webRequest, id);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    console.error("trial_admin_resend_vercel_unhandled", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
}
