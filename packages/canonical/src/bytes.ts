/**
 * Pure byte-level helpers shared by the Node entry (index.ts) and the browser entry
 * (browser.ts). No imports, no I/O, no hashing — just Uint8Array manipulation. Kept separate
 * so encoding.ts has nothing platform-specific left to smuggle in.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** UTF-8 encode. Note: NOT the same as Buffer.from(s, "ascii"), which masks to 7 bits. */
export function utf8Encode(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

/** Big-endian uint32 encoding of a byte length. */
export function u32be(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Byte-wise comparison — matches Buffer.compare's contract (shared prefix, then length).
 * Deliberately not string `<`, which is UTF-16 code-unit order and diverges from UTF-8 byte
 * order above U+FFFF.
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

export function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

const HEX_RE = /^([0-9a-f]{2})*$/;

/** Inverse of toHex. Lowercase only — matches this repo's hex convention throughout. */
export function fromHex(hex: string): Uint8Array {
  if (!HEX_RE.test(hex)) {
    throw new Error(`not a valid lowercase, even-length hex string: ${JSON.stringify(hex)}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
