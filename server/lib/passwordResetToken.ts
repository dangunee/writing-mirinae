import { createHash, randomBytes } from "crypto";

import { and, eq, isNull } from "drizzle-orm";

import { passwordResetTokens } from "../../db/schema";
import { getDb } from "../db/client";

const TTL_MS = 15 * 60 * 1000;

export function generatePlainResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<{ plain: string }> {
  const db = getDb();
  const plain = generatePlainResetToken();
  const tokenHash = hashResetToken(plain);
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { plain };
}

export type ValidTokenRow = {
  id: string;
  userId: string;
};

export async function findValidResetToken(plain: string): Promise<ValidTokenRow | null> {
  const tokenHash = hashResetToken(plain);
  const db = getDb();
  const rows = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row || row.usedAt != null) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

export async function markResetTokenUsed(tokenRowId: string): Promise<void> {
  const db = getDb();
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenRowId));
}
