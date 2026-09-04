/**
 * Browser (and any WebCrypto-capable runtime) SHA-256. Async, unlike hash-node.ts's sync
 * version — subtle.digest has no synchronous form. This is the only reason any part of this
 * package is async; every encoding rule above it is pure and synchronous either way.
 */
export async function sha256Async(data: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "crypto.subtle is unavailable — Web Crypto requires a secure context (https:// or " +
        "localhost). Use the Node entry point (\"@acuris-stellar-poc/canonical\") instead.",
    );
  }
  // subtle.digest wants a BufferSource; a plain Uint8Array view qualifies. Slice defensively
  // so a caller's later mutation of `data` can never retroactively change what was hashed.
  const digestBuffer = await subtle.digest("SHA-256", data.slice());
  return new Uint8Array(digestBuffer);
}
