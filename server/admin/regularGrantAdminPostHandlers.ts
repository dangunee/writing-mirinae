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

export async function handleRegularGrantSetEnabled(req: Request, grantId: string): Promise<Response> {
  try {
    assertRegularAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const id = grantId.trim();
  if (!id || !isUuid(id)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  let body: { enabled?: unknown } = {};
  try {
    body = (await req.json()) as { enabled?: unknown };
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  if (typeof body.enabled !== "boolean") {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const db = getDb();
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

export async function handleRegularGrantSetAccessExpiry(req: Request, grantId: string): Promise<Response> {
  try {
    assertRegularAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const id = grantId.trim();
  if (!id || !isUuid(id)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  let body: { accessExpiresAt?: unknown } = {};
  try {
    body = (await req.json()) as { accessExpiresAt?: unknown };
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

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

  const db = getDb();
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

export async function handleRegularGrantResendAccess(req: Request, grantId: string): Promise<Response> {
  try {
    assertRegularAdminBff(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "bff_misconfigured") {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const id = grantId.trim();
  if (!id || !isUuid(id)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  /** Vercel: preview/development. Non-Vercel local: NODE_ENV. Production deploys must not echo raw tokens. */
  const includeSecrets = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV !== "production"
    : process.env.NODE_ENV !== "production";
  const db = getDb();
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
