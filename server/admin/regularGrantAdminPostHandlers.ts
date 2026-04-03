import { getDb } from "../db/client";
import { assertRegularAdminBff, isUuid } from "../lib/regularAdminAuth";
import {
  adminResendRegularAccess,
  adminSetRegularGrantAccessExpiry,
  adminSetRegularGrantEnabled,
} from "../services/regularGrantAdminService";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function mapAdminAuthError(e: unknown): Response {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "bff_misconfigured") {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }
  return json({ ok: false, error: "unauthorized" }, 401);
}

const DEV_SEED_SEGMENT = "dev-seed";

/**
 * POST /api/writing/admin/regular-access-grants/dev-seed — proxies to mirinae-api (same as former /api/writing/regular/access/dev-seed).
 * No REGULAR_ADMIN_BFF_TOKEN; optional REGULAR_DEV_SEED_SECRET → upstream in production.
 */
export async function handleRegularDevSeedProxy(req: Request): Promise<Response> {
  const base = process.env.MIRINAE_API_BASE_URL?.trim() ?? "";
  if (!base) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  let bodyBuf: ArrayBuffer;
  try {
    bodyBuf = await req.arrayBuffer();
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.REGULAR_DEV_SEED_SECRET?.trim();
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
  }

  try {
    const upstream = await fetch(`${base.replace(/\/$/, "")}/api/writing/regular/access/dev-seed`, {
      method: "POST",
      headers,
      body: bodyBuf.byteLength > 0 ? bodyBuf : "{}",
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error("regular_access_dev_seed_bff_error", e);
    return json({ ok: false, error: "request_failed" }, 500);
  }
}

/**
 * POST /api/writing/admin/regular-access-grants/:id
 * body: { action: "set_enabled" | "set_expiry" | "resend_access", ... }
 * Special id `dev-seed`: dev seed proxy (body forwarded upstream; action not required).
 */
export async function handleRegularGrantUnifiedPost(req: Request, grantId: string): Promise<Response> {
  const id = grantId.trim();
  if (id === DEV_SEED_SEGMENT) {
    return handleRegularDevSeedProxy(req);
  }

  try {
    assertRegularAdminBff(req);
  } catch (e) {
    return mapAdminAuthError(e);
  }

  if (!id || !isUuid(id)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const action = body.action;
  if (typeof action !== "string") {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const db = getDb();

  if (action === "set_enabled") {
    if (typeof body.enabled !== "boolean") {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
    const out = await adminSetRegularGrantEnabled(db, id, body.enabled);
    if (!out.ok) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    return json(
      {
        ok: true,
        grantId: out.grant.grantId,
        accessEnabled: out.grant.accessEnabled,
        accessExpiresAt: out.grant.accessExpiresAt,
        courseId: out.grant.courseId,
        studentEmail: out.grant.studentEmail,
        updatedAt: out.grant.updatedAt,
      },
      200
    );
  }

  if (action === "set_expiry") {
    let expiry: Date | null;
    if (body.accessExpiresAt === null || body.accessExpiresAt === undefined) {
      expiry = null;
    } else if (typeof body.accessExpiresAt === "string") {
      const d = new Date(body.accessExpiresAt);
      if (Number.isNaN(d.getTime())) {
        return json({ ok: false, error: "invalid_request" }, 400);
      }
      expiry = d;
    } else {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const out = await adminSetRegularGrantAccessExpiry(db, id, expiry);
    if (!out.ok) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    return json(
      {
        ok: true,
        grantId: out.grant.grantId,
        accessEnabled: out.grant.accessEnabled,
        accessExpiresAt: out.grant.accessExpiresAt,
        courseId: out.grant.courseId,
        studentEmail: out.grant.studentEmail,
        updatedAt: out.grant.updatedAt,
      },
      200
    );
  }

  if (action === "resend_access") {
    const includeSecrets = process.env.VERCEL_ENV
      ? process.env.VERCEL_ENV !== "production"
      : process.env.NODE_ENV !== "production";
    const out = await adminResendRegularAccess(db, id, includeSecrets);
    if (!out.ok) {
      if (out.error === "token_hash_failed" || out.error === "token_insert_failed") {
        return json({ ok: false, error: "server_misconfigured" }, 500);
      }
      return json({ ok: false, error: "not_found" }, 404);
    }

    const payload: Record<string, unknown> = {
      ok: true,
      grantId: out.grant.grantId,
      accessEnabled: out.grant.accessEnabled,
      accessExpiresAt: out.grant.accessExpiresAt,
      courseId: out.grant.courseId,
      studentEmail: out.grant.studentEmail,
      updatedAt: out.grant.updatedAt,
      tokenId: out.tokenId,
      mailQueued: out.mailQueued,
      mailIntegration: out.mailIntegration,
    };

    if (includeSecrets && out.rawToken && out.consumeUrl) {
      payload.rawToken = out.rawToken;
      payload.consumeUrl = out.consumeUrl;
    }

    return json(payload, 200);
  }

  return json({ ok: false, error: "invalid_request" }, 400);
}
