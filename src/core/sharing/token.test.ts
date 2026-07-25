import { describe, it, expect } from "vitest";
import { newShareToken, isValidTokenFormat } from "./token.js";

describe("newShareToken", () => {
  it("produces a 32-char base62 token", () => {
    const token = newShareToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-zA-Z]{32}$/);
  });

  it("is deterministic given the same random bytes", () => {
    const bytes = (n: number) => new Uint8Array(n).fill(0);
    // Every byte 0 → first alphabet char ("0") repeated.
    expect(newShareToken(bytes)).toBe("0".repeat(32));
  });

  it("maps bytes through the alphabet by modulo", () => {
    const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i);
    const token = newShareToken(bytes);
    // byte i → ALPHABET[i % 62]; i in 0..31 stays within the digit+lowercase range.
    expect(token.startsWith("0123456789abcdefghijklmnopqrstuv")).toBe(true);
  });

  it("returns different tokens across calls (real randomness)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(newShareToken());
    expect(seen.size).toBe(50);
  });
});

describe("isValidTokenFormat", () => {
  it("accepts well-formed tokens", () => {
    expect(isValidTokenFormat(newShareToken())).toBe(true);
    expect(isValidTokenFormat("a1".repeat(8))).toBe(true); // 16 chars — min length
  });

  it("rejects junk", () => {
    expect(isValidTokenFormat("")).toBe(false);
    expect(isValidTokenFormat("tooshort")).toBe(false); // < 16
    expect(isValidTokenFormat("has spaces in it here")).toBe(false);
    expect(isValidTokenFormat("has-dashes-and_underscores-xx")).toBe(false);
    expect(isValidTokenFormat("../../etc/passwd")).toBe(false);
    expect(isValidTokenFormat(null)).toBe(false);
    expect(isValidTokenFormat(123)).toBe(false);
    expect(isValidTokenFormat("x".repeat(65))).toBe(false); // > 64
  });
});
