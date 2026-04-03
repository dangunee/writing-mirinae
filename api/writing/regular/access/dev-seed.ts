/**
 * Vercel — POST /api/writing/regular/access/dev-seed
 * Proxies to mirinae-api with REGULAR_DEV_SEED_SECRET as Bearer (production).
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

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
    res.end(JSON.stringify({ ok: false, error: "invalid_body" }));
    return;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.REGULAR_DEV_SEED_SECRET?.trim();
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
  }

  try {
    const upstream = await fetch(`${base}/api/writing/regular/access/dev-seed`, {
      method: "POST",
      headers,
      body: bodyBuf.length > 0 ? bodyBuf : "{}",
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(text);
  } catch (e) {
    console.error("regular_access_dev_seed_bff_error", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "request_failed" }));
  }
}
