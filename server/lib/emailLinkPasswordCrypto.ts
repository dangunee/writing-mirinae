import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Short-lived encryption for pending password on email_link tokens (server secret only).
 */
function getKey(): Buffer {
  const secret = process.env.AUTH_LINK_CRYPTO_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_LINK_CRYPTO_SECRET must be set (min 16 chars)");
  }
  return scryptSync(secret, "writing-mirinae-email-link-v1", 32);
}

export function encryptEmailLinkPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptEmailLinkPassword(blob: string): string {
  const buf = Buffer.from(blob, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
