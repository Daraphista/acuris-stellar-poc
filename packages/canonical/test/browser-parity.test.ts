/**
 * Guards the isomorphic split (bytes.ts/encoding.ts/hash-node.ts/hash-web.ts): the browser
 * entry's async, WebCrypto-backed digests must produce byte-identical output to the Node
 * entry's sync, node:crypto-backed digests, for every fixture vector plus edge sizes. Node 22
 * has crypto.subtle, so this actually exercises the browser code path in CI — it isn't hoped
 * to work, it's asserted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  sha256,
  toHex,
  batchHash,
  settlementDigest,
  type BatchManifestEntry,
  type RevenueEvent,
} from "../src/index.js";
import { sha256Async, batchHashAsync, settlementDigestAsync } from "../src/browser.js";

function vectorsPath(filename: string): URL {
  return new URL(`../../../../fixtures/vectors/${filename}`, import.meta.url);
}

test("sha256Async agrees with sync sha256 across a range of input sizes", async () => {
  const sizes = [0, 1, 32, 1000, 1024 * 1024];
  for (const size of sizes) {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) data[i] = i % 256;
    assert.equal(toHex(await sha256Async(data)), toHex(sha256(data)), `size=${size}`);
  }
});

test("batchHashAsync matches sync batchHash and the pinned vectors", async () => {
  const raw = readFileSync(vectorsPath("batch-manifest-vectors.json"), "utf8");
  const vectors: { name: string; entries: BatchManifestEntry[]; expected_digest_hex: string }[] =
    JSON.parse(raw);
  assert.ok(vectors.length > 0, "vector file must not be empty");
  for (const v of vectors) {
    const asyncHex = toHex(await batchHashAsync(v.entries));
    assert.equal(asyncHex, toHex(batchHash(v.entries)), `${v.name}: async vs sync`);
    assert.equal(asyncHex, v.expected_digest_hex, `${v.name}: async vs pinned vector`);
  }
});

test("settlementDigestAsync matches sync settlementDigest and the pinned vectors", async () => {
  const raw = readFileSync(vectorsPath("settlement-vectors.json"), "utf8");
  const vectors: { name: string; event: RevenueEvent; expected_digest_hex: string }[] =
    JSON.parse(raw);
  assert.ok(vectors.length > 0, "vector file must not be empty");
  for (const v of vectors) {
    const asyncHex = toHex(await settlementDigestAsync(v.event));
    assert.equal(asyncHex, toHex(settlementDigest(v.event)), `${v.name}: async vs sync`);
    assert.equal(asyncHex, v.expected_digest_hex, `${v.name}: async vs pinned vector`);
  }
});
