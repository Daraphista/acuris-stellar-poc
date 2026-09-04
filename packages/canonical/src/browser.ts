/**
 * Canonical encoding + digest computation — browser entry point.
 *
 * Re-exports the same platform-independent encoding rules as the Node entry (index.ts), plus
 * async, WebCrypto-backed digest functions. No "node:*" import appears anywhere in this file's
 * module graph — that's what lets a bundler (Vite, etc.) ship it to a browser with zero
 * polyfills. See hash-web.ts for why these are async where the Node versions are sync.
 *
 * Do not change encoding behavior without updating docs/canonicalization.md and regenerating
 * fixtures/vectors/*.json — the Node package's tests, this package's browser-parity test, and
 * the Rust parity check in contracts/provenance all assert against those fixed vector files.
 */
import { sha256Async } from "./hash-web.js";
import { domainPreimage, type BatchManifestEntry, type RevenueEvent } from "./encoding.js";
import * as encoding from "./encoding.js";

export {
  CanonicalError,
  DOMAIN_BATCH_MANIFEST,
  DOMAIN_SETTLEMENT,
  normalizeString,
  normalizeInteger,
  normalizeTimestamp,
  lengthPrefixed,
  canonicalBatchManifestBytes,
  canonicalRevenueEventBytes,
  type BatchManifestEntry,
  type RevenueEvent,
} from "./encoding.js";
export { toHex, fromHex } from "./bytes.js";
export { sha256Async };

export async function digestAsync(
  domainTag: string,
  canonicalBytes: Uint8Array,
): Promise<Uint8Array> {
  return sha256Async(domainPreimage(domainTag, canonicalBytes));
}

export async function batchHashAsync(entries: BatchManifestEntry[]): Promise<Uint8Array> {
  return digestAsync(encoding.DOMAIN_BATCH_MANIFEST, encoding.canonicalBatchManifestBytes(entries));
}

export async function settlementDigestAsync(event: RevenueEvent): Promise<Uint8Array> {
  return digestAsync(encoding.DOMAIN_SETTLEMENT, encoding.canonicalRevenueEventBytes(event));
}
