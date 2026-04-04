import type { IncomingMessage, ServerResponse } from "http";

export const COOKIE_MAX_AGE_FALLBACK = 7 * 24 * 60 * 60;

export function getMirinaeBase(): string | null {
  const base = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
  if (!base) return null;
  return base.replace(/\/$/, "");
}

export function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** mirinae-api への JSON POST プロキシ（start-link / reissue-link 共通） */
export async function proxyPostJsonToUpstream(
  req: IncomingMessage,
  res: ServerResponse,
  upstreamPath: "/api/writing/trial/start-link" | "/api/writing/trial/reissue-link",
  logPrefix: string
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "REQUEST_FAILED" }));
    return;
  }

  const base = getMirinaeBase();
  if (!base) {
    console.error(`${logPrefix}_bff_missing_mirinae_api_base`);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "REQUEST_FAILED" }));
    return;
  }

  let bodyBuf: Buffer;
  try {
    bodyBuf = await readRawBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "REQUEST_FAILED" }));
    return;
  }

  const upstreamUrl = `${base}${upstreamPath}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: bodyBuf,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(text);
  } catch (e) {
    console.error(`${logPrefix}_bff_upstream_error`, e);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "REQUEST_FAILED" }));
  }
}
