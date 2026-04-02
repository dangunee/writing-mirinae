import type { IncomingMessage } from "http";

type ReqWithBody = IncomingMessage & { body?: unknown };

/**
 * Vercel Node Serverless の req.body が付かない場合にストリームから読む。
 */
export async function readJsonObjectFromVercelRequest(req: ReqWithBody): Promise<Record<string, unknown>> {
  const b = req.body;
  if (b && typeof b === "object" && !Array.isArray(b) && !(b instanceof Buffer)) {
    return b as Record<string, unknown>;
  }
  if (Buffer.isBuffer(b)) {
    const s = b.toString("utf8");
    if (!s) return {};
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const buf = await streamToBuffer(req);
  const s = buf.toString("utf8");
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function streamToBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
