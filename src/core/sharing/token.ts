/**
 * Share tokens: unguessable, URL-safe identifiers for the public read-only view
 * of a book's kept study material. Pure, with the randomness injectable so the
 * generator is deterministic under test.
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"; // base62
const TOKEN_LENGTH = 32; // ~190 bits of entropy — not enumerable

export type RandomBytes = (n: number) => Uint8Array;

const defaultRandomBytes: RandomBytes = (n) => {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/** A fresh, unguessable base62 share token. */
export function newShareToken(randomBytes: RandomBytes = defaultRandomBytes): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = "";
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length]!;
  }
  return out;
}

/** Cheap format guard so the public route can reject junk before touching the DB. */
export function isValidTokenFormat(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-zA-Z]{16,64}$/.test(token);
}
