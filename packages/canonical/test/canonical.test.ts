import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CanonicalError,
  DOMAIN_BATCH_MANIFEST,
  DOMAIN_SETTLEMENT,
  batchHash,
  canonicalBatchManifestBytes,
  canonicalRevenueEventBytes,
  lengthPrefixed,
  normalizeInteger,
  normalizeString,
  normalizeTimestamp,
  settlementDigest,
  toHex,
  type BatchManifestEntry,
  type RevenueEvent,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

test("lengthPrefixed: 4-byte BE length + utf8 bytes", () => {
  const lp = lengthPrefixed("abc");
  assert.equal(lp.length, 4 + 3);
  assert.equal(lp.readUInt32BE(0), 3);
  assert.equal(lp.subarray(4).toString("utf8"), "abc");
});

test("lengthPrefixed: empty string is length 0, no ambiguity with absence", () => {
  const lp = lengthPrefixed("");
  assert.equal(lp.length, 4);
  assert.equal(lp.readUInt32BE(0), 0);
});

test("normalizeString: NFC-normalizes", () => {
  const decomposed = "é"; // "e" + combining acute accent
  const precomposed = "é"; // "é"
  assert.equal(normalizeString(decomposed), normalizeString(precomposed));
});

test("normalizeString: rejects control characters instead of stripping", () => {
  assert.throws(() => normalizeString("bad\x01value"), CanonicalError);
  assert.throws(() => normalizeString("trailing\n"), CanonicalError);
});

test("normalizeInteger: canonical decimal form, rejects leading zeros", () => {
  assert.equal(normalizeInteger(0), "0");
  assert.equal(normalizeInteger(42), "42");
  assert.equal(normalizeInteger("18446744073709551615"), "18446744073709551615");
  assert.throws(() => normalizeInteger("007"), CanonicalError);
  assert.throws(() => normalizeInteger(-1), CanonicalError);
  assert.throws(() => normalizeInteger("18446744073709551616"), CanonicalError);
});

test("normalizeTimestamp: requires RFC3339 UTC second precision with Z", () => {
  assert.equal(normalizeTimestamp("2026-09-03T14:05:00Z"), "2026-09-03T14:05:00Z");
  assert.throws(() => normalizeTimestamp("2026-09-03T14:05:00.000Z"), CanonicalError);
  assert.throws(() => normalizeTimestamp("2026-09-03T14:05:00+08:00"), CanonicalError);
  assert.throws(() => normalizeTimestamp("2026-13-03T14:05:00Z"), CanonicalError);
});

// ---------------------------------------------------------------------------
// Batch manifest (D2)
// ---------------------------------------------------------------------------

const SAMPLE_HASH_A = "a".repeat(64);
const SAMPLE_HASH_B = "b".repeat(64);

test("canonicalBatchManifestBytes: order-independent (sorts internally)", () => {
  const a: BatchManifestEntry[] = [
    { relativePath: "b.txt", sha256Hex: SAMPLE_HASH_B },
    { relativePath: "a.txt", sha256Hex: SAMPLE_HASH_A },
  ];
  const b: BatchManifestEntry[] = [a[1], a[0]];
  assert.deepEqual(canonicalBatchManifestBytes(a), canonicalBatchManifestBytes(b));
});

test("batchHash: rejects duplicate relativePath", () => {
  const entries: BatchManifestEntry[] = [
    { relativePath: "a.txt", sha256Hex: SAMPLE_HASH_A },
    { relativePath: "a.txt", sha256Hex: SAMPLE_HASH_B },
  ];
  assert.throws(() => batchHash(entries), CanonicalError);
});

test("batchHash: rejects malformed sha256Hex", () => {
  const entries: BatchManifestEntry[] = [{ relativePath: "a.txt", sha256Hex: "not-hex" }];
  assert.throws(() => batchHash(entries), CanonicalError);
});

test("batchHash: is deterministic across repeated calls", () => {
  const entries: BatchManifestEntry[] = [{ relativePath: "a.txt", sha256Hex: SAMPLE_HASH_A }];
  assert.equal(toHex(batchHash(entries)), toHex(batchHash(entries)));
});

// ---------------------------------------------------------------------------
// Revenue event (D1)
// ---------------------------------------------------------------------------

const SAMPLE_EVENT: RevenueEvent = {
  eventId: "evt_001",
  source: "e-konsulta-lab-routing",
  assetCode: "SRT",
  grossAmountMinor: "10000000",
  occurredAt: "2026-09-03T14:05:00Z",
  partnerRef: "e-konsulta-medical-clinic",
};

test("canonicalRevenueEventBytes: fixed field order, length-prefixed", () => {
  const bytes = canonicalRevenueEventBytes(SAMPLE_EVENT);
  // event_id LP first: 4-byte len(7) + "evt_001"
  assert.equal(bytes.readUInt32BE(0), 7);
  assert.equal(bytes.subarray(4, 11).toString("utf8"), "evt_001");
});

test("settlementDigest: deterministic, 32 bytes", () => {
  const d = settlementDigest(SAMPLE_EVENT);
  assert.equal(d.length, 32);
  assert.equal(toHex(d), toHex(settlementDigest(SAMPLE_EVENT)));
});

test("settlementDigest: changing any field changes the digest", () => {
  const base = toHex(settlementDigest(SAMPLE_EVENT));
  const variants: RevenueEvent[] = [
    { ...SAMPLE_EVENT, eventId: "evt_002" },
    { ...SAMPLE_EVENT, grossAmountMinor: "10000001" },
    { ...SAMPLE_EVENT, occurredAt: "2026-09-03T14:05:01Z" },
    { ...SAMPLE_EVENT, partnerRef: "someone-else" },
  ];
  for (const v of variants) {
    assert.notEqual(toHex(settlementDigest(v)), base);
  }
});

// ---------------------------------------------------------------------------
// Cross-language parity vectors — the Rust suite asserts against the same files.
// ---------------------------------------------------------------------------

interface BatchManifestVector {
  name: string;
  entries: BatchManifestEntry[];
  expected_domain_tag: string;
  expected_digest_hex: string;
}

interface SettlementVector {
  name: string;
  event: RevenueEvent;
  expected_domain_tag: string;
  expected_digest_hex: string;
}

function vectorsPath(filename: string): URL {
  return new URL(`../../../../fixtures/vectors/${filename}`, import.meta.url);
}

test("batch manifest digest vectors match fixtures/vectors/batch-manifest-vectors.json", () => {
  const raw = readFileSync(vectorsPath("batch-manifest-vectors.json"), "utf8");
  const vectors: BatchManifestVector[] = JSON.parse(raw);
  assert.ok(vectors.length > 0, "vector file must not be empty");
  for (const v of vectors) {
    assert.equal(v.expected_domain_tag, DOMAIN_BATCH_MANIFEST, v.name);
    assert.equal(toHex(batchHash(v.entries)), v.expected_digest_hex, v.name);
  }
});

test("settlement digest vectors match fixtures/vectors/settlement-vectors.json", () => {
  const raw = readFileSync(vectorsPath("settlement-vectors.json"), "utf8");
  const vectors: SettlementVector[] = JSON.parse(raw);
  assert.ok(vectors.length > 0, "vector file must not be empty");
  for (const v of vectors) {
    assert.equal(v.expected_domain_tag, DOMAIN_SETTLEMENT, v.name);
    assert.equal(toHex(settlementDigest(v.event)), v.expected_digest_hex, v.name);
  }
});
