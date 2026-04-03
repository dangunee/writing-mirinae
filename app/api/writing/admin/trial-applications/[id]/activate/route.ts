export const runtime = "nodejs";

/** POST /api/writing/admin/trial-applications/:id/activate */
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

function logUpstreamBody(raw: string): string {
  const max = 4000;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? "";
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

  let body: string | undefined;
  try {
    const raw = await req.text();
    body = raw || undefined;
  } catch {
    body = undefined;
  }

  const bodyLen = body?.length ?? 0;
  console.info("[trial activate bff] request start", { applicationId, bodyLength: bodyLen });

  const upstreamUrl = `${cfg.base}/api/admin/trial-applications/${encodeURIComponent(applicationId)}/activate`;
  console.info("[trial activate bff] upstream url", upstreamUrl);

  try {
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        "Content-Type": "application/json",
      },
      body: body ?? "{}",
    });
    const text = await res.text();
    console.info("[trial activate bff] upstream status", res.status);
    console.info("[trial activate bff] upstream raw body", logUpstreamBody(text));

    let outText = text;
    const st = res.status;
    if (st >= 400 && !text.trim()) {
      outText = JSON.stringify({ ok: false, error: `upstream_${st}` });
    } else if (st >= 400) {
      try {
        const parsed = JSON.parse(text) as { ok?: boolean; error?: string };
        if (parsed && typeof parsed === "object" && parsed.ok === false && typeof parsed.error !== "string") {
          outText = JSON.stringify({ ...parsed, ok: false, error: `upstream_${st}` });
        }
      } catch {
        outText = JSON.stringify({ ok: false, error: `upstream_${st}`, detail: "non_json_upstream" });
      }
    }

    console.info("[trial activate bff] response sent", {
      status: st,
      bodyLength: outText.length,
    });

    return new Response(outText, {
      status: res.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("[trial activate bff] fetch error", e);
    const errBody = JSON.stringify({ ok: false, error: "upstream_unavailable" });
    console.info("[trial activate bff] response sent", { status: 502, bodyLength: errBody.length });
    return new Response(errBody, {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
