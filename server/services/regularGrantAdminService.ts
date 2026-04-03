import { and, eq, isNull } from "drizzle-orm";

import { regularAccessGrants, regularAccessTokens } from "../../db/schema";
import type { Db } from "../db/client";
import { REGULAR_ACCESS_LINK_TOKEN_TTL_MINUTES } from "../lib/regularAccessConstants";
import { generateRawAccessToken, hashWritingAccessToken } from "../lib/writingAccessToken";

function publicSiteBase(): string {
  const base =
    process.env.TRIAL_WRITING_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://mirinae.jp";
  return base.replace(/\/$/, "");
}

function buildConsumeUrl(rawToken: string): string {
  const path = "/writing/regular/access";
  const url = new URL(path, publicSiteBase() + "/");
  url.searchParams.set("token", rawToken);
  return url.toString();
}

export type RegularGrantSnapshot = {
  grantId: string;
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  courseId: string | null;
  studentEmail: string;
  updatedAt: string;
};

function toSnapshot(row: typeof regularAccessGrants.$inferSelect): RegularGrantSnapshot {
  return {
    grantId: row.id,
    accessEnabled: row.accessEnabled,
    accessExpiresAt: row.accessExpiresAt ? row.accessExpiresAt.toISOString() : null,
    courseId: row.courseId ?? null,
    studentEmail: row.studentEmail,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function adminSetRegularGrantEnabled(
  db: Db,
  grantId: string,
  enabled: boolean
): Promise<{ ok: true; grant: RegularGrantSnapshot } | { ok: false; error: "not_found" }> {
  const [existing] = await db
    .select()
    .from(regularAccessGrants)
    .where(eq(regularAccessGrants.id, grantId))
    .limit(1);
  if (!existing) {
    return { ok: false, error: "not_found" };
  }
  const now = new Date();
  await db
    .update(regularAccessGrants)
    .set({ accessEnabled: enabled, updatedAt: now })
    .where(eq(regularAccessGrants.id, grantId));
  const [row] = await db.select().from(regularAccessGrants).where(eq(regularAccessGrants.id, grantId)).limit(1);
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, grant: toSnapshot(row) };
}

export async function adminSetRegularGrantAccessExpiry(
  db: Db,
  grantId: string,
  accessExpiresAt: Date | null
): Promise<{ ok: true; grant: RegularGrantSnapshot } | { ok: false; error: "not_found" }> {
  const [existing] = await db
    .select()
    .from(regularAccessGrants)
    .where(eq(regularAccessGrants.id, grantId))
    .limit(1);
  if (!existing) {
    return { ok: false, error: "not_found" };
  }
  const now = new Date();
  await db
    .update(regularAccessGrants)
    .set({ accessExpiresAt, updatedAt: now })
    .where(eq(regularAccessGrants.id, grantId));
  const [row] = await db.select().from(regularAccessGrants).where(eq(regularAccessGrants.id, grantId)).limit(1);
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, grant: toSnapshot(row) };
}

export type AdminResendAccessResult =
  | {
      ok: true;
      grant: RegularGrantSnapshot;
      tokenId: string;
      mailQueued: false;
      /** Dev/staging only when includeSecrets */
      rawToken?: string;
      consumeUrl?: string;
      /** Production placeholder until mail is wired */
      mailIntegration: "not_configured";
    }
  | { ok: false; error: "not_found" | "token_hash_failed" | "token_insert_failed" };

/**
 * Revokes unused tokens, inserts new 15m token (hash only). Raw token never stored in DB.
 */
export async function adminResendRegularAccess(
  db: Db,
  grantId: string,
  includeSecretsInResponse: boolean
): Promise<AdminResendAccessResult> {
  const [existing] = await db
    .select()
    .from(regularAccessGrants)
    .where(eq(regularAccessGrants.id, grantId))
    .limit(1);
  if (!existing) {
    return { ok: false, error: "not_found" };
  }

  const raw = generateRawAccessToken();
  let tokenHash: string;
  try {
    tokenHash = hashWritingAccessToken(raw);
  } catch {
    return { ok: false, error: "token_hash_failed" };
  }

  const linkExp = new Date(Date.now() + REGULAR_ACCESS_LINK_TOKEN_TTL_MINUTES * 60 * 1000);
  const now = new Date();

  const [tok] = await db.transaction(async (tx) => {
    await tx
      .update(regularAccessTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(regularAccessTokens.regularAccessGrantId, grantId),
          isNull(regularAccessTokens.usedAt),
          isNull(regularAccessTokens.revokedAt)
        )
      );

    return tx
      .insert(regularAccessTokens)
      .values({
        regularAccessGrantId: grantId,
        tokenHash,
        expiresAt: linkExp,
      })
      .returning({ id: regularAccessTokens.id });
  });

  if (!tok) {
    return { ok: false, error: "token_insert_failed" };
  }

  const [grantRow] = await db.select().from(regularAccessGrants).where(eq(regularAccessGrants.id, grantId)).limit(1);
  if (!grantRow) {
    return { ok: false, error: "not_found" };
  }

  const base: AdminResendAccessResult = {
    ok: true,
    grant: toSnapshot(grantRow),
    tokenId: tok.id,
    mailQueued: false,
    mailIntegration: "not_configured",
  };

  if (includeSecretsInResponse) {
    return {
      ...base,
      rawToken: raw,
      consumeUrl: buildConsumeUrl(raw),
    };
  }

  return base;
}
