/**
 * Deterministic xorshift128 PRNG — not a test file itself (doesn't match *.test.ts), just a
 * helper. No new dependency, reproducible across CI runs. Not cryptographic; used only to
 * generate wide-range property-test inputs.
 */
export function makeRng(seed: number): () => number {
  let x = (123456789 ^ seed) >>> 0;
  let y = 362436069;
  let z = 521288629;
  let w = 88675123;
  return function next(): number {
    const t = (x ^ (x << 11)) >>> 0;
    x = y;
    y = z;
    z = w;
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return w;
  };
}

/** A bigint drawn from [min, max] inclusive, built from enough 32-bit chunks of `rng()` to
 *  cover the range (plus one extra chunk to keep modulo bias negligible for test purposes). */
export function randomBigInt(rng: () => number, min: bigint, max: bigint): bigint {
  const range = max - min + 1n;
  const bitLength = range.toString(2).length;
  const chunks = Math.ceil(bitLength / 32) + 1;
  let acc = 0n;
  for (let i = 0; i < chunks; i++) {
    acc = (acc << 32n) | BigInt(rng());
  }
  return min + (acc % range);
}
