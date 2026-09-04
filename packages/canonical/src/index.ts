/**
 * Canonical encoding + digest computation — Node entry point.
 *
 * This re-exports the platform-independent encoding rules from encoding.ts and adds the
 * synchronous, node:crypto-backed digest functions. Every name and signature here is the same
 * as before this package was split into encoding.ts/hash-node.ts/hash-web.ts — this file exists
 * so nothing that already imports "@acuris-stellar-poc/canonical" needs to change.
 *
 * For a browser bundle, import "@acuris-stellar-poc/canonical/browser" instead — it has no
 * node:crypto dependency, but its digest functions are async (see hash-web.ts for why).
 *
 * Do not change encoding behavior without updating docs/canonicalization.md and regenerating
 * fixtures/vectors/*.json — both this package's tests and the Rust parity check in
 * contracts/provenance assert against those fixed vector files.
 */
import { sha256Sync } from "./hash-node.js";
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

export function sha256(data: Uint8Array): Uint8Array {
  return sha256Sync(data);
}

/** digest = SHA-256(domain_tag || 0x00 || canonical_bytes) */
export function digest(domainTag: string, canonicalBytes: Uint8Array): Uint8Array {
  return sha256Sync(domainPreimage(domainTag, canonicalBytes));
}

/** batch_hash = SHA-256("acuris.batch-manifest.v1" || 0x00 || canonical manifest bytes) */
export function batchHash(entries: BatchManifestEntry[]): Uint8Array {
  return digest(encoding.DOMAIN_BATCH_MANIFEST, encoding.canonicalBatchManifestBytes(entries));
}

/** settlement_digest = SHA-256("acuris.settlement.v1" || 0x00 || canonical event bytes) */
export function settlementDigest(event: RevenueEvent): Uint8Array {
  return digest(encoding.DOMAIN_SETTLEMENT, encoding.canonicalRevenueEventBytes(event));
}
