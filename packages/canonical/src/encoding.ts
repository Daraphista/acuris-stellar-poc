/**
 * Canonical encoding rules — the pure, hash-independent half of docs/canonicalization.md.
 * Shared byte-for-byte between the Node entry (index.ts) and the browser entry (browser.ts) —
 * this file never imports a hash function, so it cannot drift between the two.
 *
 * Do not change behavior here without updating that document and regenerating
 * fixtures/vectors/*.json — both this package's tests and the Rust parity check in
 * contracts/provenance assert against those fixed vector files.
 */
import { compareBytes, concatBytes, u32be, utf8Encode } from "./bytes.js";

export class CanonicalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalError";
  }
}

export const DOMAIN_BATCH_MANIFEST = "acuris.batch-manifest.v1";
export const DOMAIN_SETTLEMENT = "acuris.settlement.v1";

const MAX_U64 = 18446744073709551615n;

// A C0 control character (0x00-0x1F) or DEL (0x7F) anywhere in the string.
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;

/** NFC-normalize a string and reject control characters. Never silently strips. */
export function normalizeString(value: string): string {
  const normalized = value.normalize("NFC");
  if (CONTROL_CHAR_RE.test(normalized)) {
    throw new CanonicalError(
      `string contains a control character: ${JSON.stringify(value)}`,
    );
  }
  return normalized;
}

/** Canonical minimal-decimal-ASCII form of a non-negative integer in [0, 2^64-1]. */
export function normalizeInteger(value: string | number | bigint): string {
  let n: bigint;
  try {
    n = typeof value === "string" ? BigInt(value) : BigInt(value);
  } catch {
    throw new CanonicalError(`not an integer: ${JSON.stringify(value)}`);
  }
  if (typeof value === "string" && !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new CanonicalError(`integer string is not in minimal decimal form: ${value}`);
  }
  if (n < 0n || n > MAX_U64) {
    throw new CanonicalError(`integer out of range [0, 2^64-1]: ${n}`);
  }
  return n.toString(10);
}

const RFC3339_UTC_SECONDS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Validates RFC 3339, UTC, second precision, literal 'Z' suffix. Returns the value unchanged. */
export function normalizeTimestamp(value: string): string {
  if (!RFC3339_UTC_SECONDS_RE.test(value)) {
    throw new CanonicalError(
      `timestamp must be RFC3339 UTC, second precision, 'Z' suffix (e.g. 2026-09-03T14:05:00Z): got ${value}`,
    );
  }
  // Reject calendar-invalid values (e.g. month 13) that the regex alone can't catch.
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new CanonicalError(`not a valid calendar timestamp: ${value}`);
  }
  return value;
}

/** LP(value) = uint32_BE(byte_length(utf8(value))) || utf8(value) */
export function lengthPrefixed(value: string): Uint8Array {
  const utf8 = utf8Encode(value);
  if (utf8.byteLength > 0xffffffff) {
    throw new CanonicalError("value too long to length-prefix with a u32");
  }
  return concatBytes([u32be(utf8.byteLength), utf8]);
}

/** The exact bytes a digest hashes: domain_tag || 0x00 || canonical_bytes. Hashing itself is
 *  the one platform-specific step — see hash-node.ts / hash-web.ts. */
export function domainPreimage(domainTag: string, canonicalBytes: Uint8Array): Uint8Array {
  return concatBytes([utf8Encode(domainTag), new Uint8Array([0x00]), canonicalBytes]);
}

// ---------------------------------------------------------------------------
// Object 1: Batch manifest (D2)
// ---------------------------------------------------------------------------

export interface BatchManifestEntry {
  relativePath: string;
  /** lowercase hex, 64 chars — SHA-256 of the raw file bytes */
  sha256Hex: string;
}

const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Canonical bytes for a batch manifest: entries sorted ascending by (NFC-normalized)
 * relativePath, byte-wise on UTF-8, duplicates rejected, each entry LP-encoded in order.
 */
export function canonicalBatchManifestBytes(entries: BatchManifestEntry[]): Uint8Array {
  const normalized = entries.map((e) => {
    const relativePath = normalizeString(e.relativePath);
    const sha256Hex = e.sha256Hex.toLowerCase();
    if (!HEX64_RE.test(sha256Hex)) {
      throw new CanonicalError(
        `sha256Hex must be 64 lowercase hex chars: ${JSON.stringify(e.sha256Hex)}`,
      );
    }
    return { relativePath, sha256Hex };
  });

  const sorted = [...normalized].sort((a, b) =>
    compareBytes(utf8Encode(a.relativePath), utf8Encode(b.relativePath)),
  );

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].relativePath === sorted[i - 1].relativePath) {
      throw new CanonicalError(`duplicate relativePath in manifest: ${sorted[i].relativePath}`);
    }
  }

  return concatBytes(
    sorted.flatMap((e) => [lengthPrefixed(e.relativePath), lengthPrefixed(e.sha256Hex)]),
  );
}

// ---------------------------------------------------------------------------
// Object 2: Revenue event (D1)
// ---------------------------------------------------------------------------

export interface RevenueEvent {
  eventId: string;
  source: string;
  assetCode: string;
  /** integer minor units, as a decimal string, number, or bigint */
  grossAmountMinor: string | number | bigint;
  /** RFC3339 UTC, second precision, 'Z' suffix */
  occurredAt: string;
  partnerRef: string;
}

/** Canonical bytes for a revenue event, fields in the fixed order from docs/canonicalization.md. */
export function canonicalRevenueEventBytes(event: RevenueEvent): Uint8Array {
  const eventId = normalizeString(event.eventId);
  const source = normalizeString(event.source);
  const assetCode = normalizeString(event.assetCode);
  const grossAmountMinor = normalizeInteger(event.grossAmountMinor);
  const occurredAt = normalizeTimestamp(event.occurredAt);
  const partnerRef = normalizeString(event.partnerRef);

  return concatBytes([
    lengthPrefixed(eventId),
    lengthPrefixed(source),
    lengthPrefixed(assetCode),
    lengthPrefixed(grossAmountMinor),
    lengthPrefixed(occurredAt),
    lengthPrefixed(partnerRef),
  ]);
}
