import { createHash, randomBytes } from "crypto";

import { and, eq, isNull } from "drizzle-orm";

import { emailVerificationTokens } from "../../db/schema";
import { getDb } from "../db/client";

const TTL_MS = 15 * 60 * 1000;

export type EmailVerificationPurpose = "line_onboarding" | "email_link";

export function generatePlainVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashVerificationToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export async function createEmailVerificationToken(params: {
  userId: string;
  purpose: EmailVerificationPurpose;
  pendingEmail: string;
  passwordEncrypted?: string | null;
}): Promise<{ plain: string }> {
  const db = getDb();
  const plain = generatePlainVerificationToken();
  const tokenHash = hashVerificationToken(plain);
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db
    .delete(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, params.userId),
        eq(emailVerificationTokens.purpose, params.purpose),
        isNull(emailVerificationTokens.usedAt)
      )
    );

  await db.insert(emailVerificationTokens).values({
    userId: params.userId,
    tokenHash,
    purpose: params.purpose,
    pendingEmail: params.pendingEmail.trim().toLowerCase(),
    passwordEncrypted: params.passwordEncrypted ?? null,
    expiresAt,
  });

  return { plain };
}

export type ValidEmailVerificationRow = {
  id: string;
  userId: string;
  pendingEmail: string;
  purpose: EmailVerificationPurpose;
  passwordEncrypted: string | null;
};

export async function findValidEmailVerificationToken(plain: string): Promise<ValidEmailVerificationRow | null> {
  const tokenHash = hashVerificationToken(plain);
  const db = getDb();
  const rows = await db
    .select({
      id: emailVerificationTokens.id,
      userId: emailVerificationTokens.userId,
      pendingEmail: emailVerificationTokens.pendingEmail,
      purpose: emailVerificationTokens.purpose,
      passwordEncrypted: emailVerificationTokens.passwordEncrypted,
      expiresAt: emailVerificationTokens.expiresAt,
      usedAt: emailVerificationTokens.usedAt,
    })
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row || row.usedAt != null) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return {
    id: row.id,
    userId: row.userId,
    pendingEmail: row.pendingEmail,
    purpose: row.purpose,
    passwordEncrypted: row.passwordEncrypted,
  };
}

export async function markEmailVerificationTokenUsed(tokenRowId: string): Promise<void> {
  const db = getDb();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, tokenRowId));
}
