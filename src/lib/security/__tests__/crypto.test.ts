import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  generateEncryptionKey,
} from "@/lib/security/crypto";

describe("crypto", () => {
  it("round-trips a secret through encrypt → decrypt", () => {
    const plaintext = "ya29.a0_very-long-google-refresh-token-123456789";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces an iv:tag:ciphertext payload", () => {
    const encrypted = encryptSecret("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // 12-byte IV → 24 hex chars; GCM tag 16 bytes → 32 hex chars.
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is non-deterministic (fresh IV each time)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("throws on a malformed payload", () => {
    expect(() => decryptSecret("not-a-payload")).toThrow(/Malformed/);
  });

  it("fails to decrypt when the payload was tampered with", () => {
    const encrypted = encryptSecret("secret");
    const parts = encrypted.split(":");
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith("0") ? "1" : "0");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("generates a 64-character hex encryption key", () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
