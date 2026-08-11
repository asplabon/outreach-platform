import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { env } from "@/lib/env";

/**
 * AES-256-GCM symmetric encryption for sensitive values at rest (OAuth
 * access/refresh tokens, etc.). Encrypted payloads are never sent to the
 * browser — they only leave the server inside the database.
 *
 * The master key is derived from ENCRYPTION_KEY via SHA-256, so any string
 * (hex or otherwise) yields a correct 32-byte key.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function masterKey(): Buffer {
  return createHash("sha256").update(env.ENCRYPTION_KEY).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    masterKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** Generate a fresh ENCRYPTION_KEY value (32 random bytes, hex). */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
