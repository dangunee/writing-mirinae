/**
 * Vercel — GET /api/writing/regular/session/current
 * Forwards Cookie to mirinae-api.
 */
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  runtime: "nodejs",
  maxDuration: 15,
};

function mirinaeBase(): string | null {
  const base = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
  if (!base) return null;
  return base.replace(/\/$/, "");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "UNAUTHORIZED" }));
    return;
  }

  const base = mirinaeBase();
  if (!base) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "UNAUTHORIZED" }));
    return;
  }

  const cookie = req.headers.cookie ?? "";

  try {
    const upstream = await fetch(`${base}/api/writing/regular/session/current`, {
      method: "GET",
      headers: cookie ? { Cookie: cookie } : {},
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (upstream.status >= 500) {
      console.warn("regular_session_current_bff_upstream", { status: upstream.status });
    }
    res.end(text);
  } catch (e) {
    console.error("regular_session_current_bff_error", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "UNAUTHORIZED" }));
  }
}
