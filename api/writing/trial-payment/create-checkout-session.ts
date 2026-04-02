/**
 * Vercel Serverless — Vite 静的デプロイ時は Next `app/api` が含まれないため、
 * 体験決済 Checkout 作成はこのファイルで提供する。
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleTrialCreateCheckoutSessionRequest } from "../../_lib/trialCreateCheckoutSessionHandler";

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
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const host = req.headers.host ?? "localhost";
  const path = req.url?.split("?")[0] ?? "/api/writing/trial-payment/create-checkout-session";
  const search = req.url?.includes("?") ? `?${req.url.split("?")[1]}` : "";
  const url = `https://${host}${path}${search}`;

  try {
    const rawBody = await readRawBody(req);
    const webRequest = new Request(url, {
      method: "POST",
      headers: req.headers as HeadersInit,
      body: rawBody,
    });
    const response = await handleTrialCreateCheckoutSessionRequest(webRequest);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("trial_create_checkout_vercel_unhandled", { message });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
