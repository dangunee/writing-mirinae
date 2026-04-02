/**
 * Vercel Serverless — `vite build` では Next `app/api` がデプロイされないため、
 * このファイルで `/api/webhooks/stripe` を提供する。
 *
 * Vercel Node ランタイムは `IncomingMessage` / `ServerResponse` を渡すことが多く、
 * Web `Request` の `arrayBuffer()` は存在しない → 500 になる。raw body を自前で読む。
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleWritingStripeWebhookPost } from "../../server/services/writingStripeWebhook";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
  api: {
    bodyParser: false,
  },
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    const host = req.headers.host ?? "localhost";
    const path = req.url?.split("?")[0] ?? "/api/webhooks/stripe";
    const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
    const url = `https://${host}${path}${search}`;

    const rawBody = await readRawBody(req);
    const webRequest = new Request(url, {
      method: "POST",
      headers: req.headers as HeadersInit,
      body: rawBody,
    });

    const response = await handleWritingStripeWebhookPost(webRequest);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    console.error("writing_stripe_webhook_unhandled", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
