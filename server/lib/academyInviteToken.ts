import { createHash, randomBytes } from "crypto";

export function generateAcademyInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashAcademyInviteToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function normalizeEmailForInvite(email: string): string {
  return email.trim().toLowerCase();
}
