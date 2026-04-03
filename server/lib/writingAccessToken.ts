import { createHash, randomBytes } from "crypto";

/**
 * Same algorithm as mirinae-api `server/lib/trial/token.ts` (TRIAL_TOKEN_PEPPER).
 * Regular mail-link tokens must hash identically for consume on mirinae-api.
 */
export function generateRawAccessToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashWritingAccessToken(rawToken: string): string {
  const pepper = process.env.TRIAL_TOKEN_PEPPER?.trim() ?? "";
  if (!pepper) {
    throw new Error("TRIAL_TOKEN_PEPPER is required for writing access tokens");
  }
  return createHash("sha256").update(rawToken, "utf8").update(pepper, "utf8").digest("hex");
}
