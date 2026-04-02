/**
 * Vercel Serverless — GET payment-result（完了ページ用 Session 取得）
 */
import type { IncomingMessage, ServerResponse } from "http";

import { handleTrialPaymentResultGet } from "../../../server/lib/trialPaymentResultHandler";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const host = req.headers.host ?? "localhost";
  const pathWithQuery = req.url ?? "/api/writing/trial-payment/payment-result";
  const url = `https://${host}${pathWithQuery}`;

  try {
    const webRequest = new Request(url, {
      method: "GET",
      headers: req.headers as HeadersInit,
    });
    const response = await handleTrialPaymentResultGet(webRequest);
    const text = await response.text();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.end(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("trial_payment_result_vercel_unhandled", { message });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
