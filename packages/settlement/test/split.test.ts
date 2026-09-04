import { test } from "node:test";
import assert from "node:assert/strict";

import { SplitError } from "../src/errors.js";
import { splitFiftyFifty, REMAINDER_RECIPIENT } from "../src/split.js";
import { makeRng, randomBigInt } from "./prng.js";

// Real, funded Testnet accounts (see docs/evidence.md) — using the real addresses here means
// this test doubles as a shape-check on the values the demo actually pays out to.
const ACURIS = "GCNSHF5IZWGJ2G4TT5U2EQSC7BHGGZJ6M3WYQZA4IK5CURY6G55AI64D";
const PARTNER = "GBJ2NHWARQWMVZZI6V2P2VSXNV4WEFCFYOBRYK6JFV6BXO4QANQLZZTM";

function split(grossMinor: bigint | string | number) {
  return splitFiftyFifty({ grossMinor, acurisDestination: ACURIS, partnerDestination: PARTNER });
}

test("splitFiftyFifty: even gross splits exactly, no remainder", () => {
  const s = split(100n);
  assert.equal(s.legs[0].amountMinor, 50n);
  assert.equal(s.legs[1].amountMinor, 50n);
  assert.equal(s.remainderMinor, 0n);
});

test("splitFiftyFifty: odd gross puts the extra unit on the fixed remainder recipient", () => {
  const s = split(101n);
  assert.equal(REMAINDER_RECIPIENT, "partner");
  assert.equal(s.legs[0].role, "acuris");
  assert.equal(s.legs[0].amountMinor, 50n);
  assert.equal(s.legs[1].role, "partner");
  assert.equal(s.legs[1].amountMinor, 51n);
  assert.equal(s.remainderMinor, 1n);
});

test("splitFiftyFifty: minimum viable gross (2) splits to 1/1", () => {
  const s = split(2n);
  assert.equal(s.legs[0].amountMinor, 1n);
  assert.equal(s.legs[1].amountMinor, 1n);
});

test("splitFiftyFifty: gross below 2 is rejected — cannot express as two positive legs", () => {
  assert.throws(() => split(0n), SplitError);
  assert.throws(() => split(1n), SplitError);
  assert.throws(() => split("0"), SplitError); // the settlement-vectors.json zero-amount vector
});

test("splitFiftyFifty: rejects malformed destination addresses", () => {
  assert.throws(
    () => splitFiftyFifty({ grossMinor: 10n, acurisDestination: "not-an-address", partnerDestination: PARTNER }),
    SplitError,
  );
  assert.throws(
    () => splitFiftyFifty({ grossMinor: 10n, acurisDestination: ACURIS, partnerDestination: "short" }),
    SplitError,
  );
});

test("splitFiftyFifty: property — legs always sum to gross, over a wide random range", () => {
  const rng = makeRng(424242);
  const MAX_U64 = 18446744073709551615n;
  for (let i = 0; i < 10000; i++) {
    const gross = randomBigInt(rng, 2n, 2n ** 63n);
    const s = split(gross);
    assert.equal(s.legs[0].amountMinor + s.legs[1].amountMinor, gross, `sum at gross=${gross}`);
    const diff = s.legs[0].amountMinor > s.legs[1].amountMinor
      ? s.legs[0].amountMinor - s.legs[1].amountMinor
      : s.legs[1].amountMinor - s.legs[0].amountMinor;
    assert.ok(diff <= 1n, `legs differ by more than 1 at gross=${gross}`);
    assert.ok(s.legs[0].amountMinor > 0n && s.legs[1].amountMinor > 0n, `a leg is non-positive at gross=${gross}`);
    assert.equal(s.remainderMinor, gross % 2n, `remainderMinor mismatch at gross=${gross}`);
  }

  // Explicit boundaries, including past Number.MAX_SAFE_INTEGER — proves no float path is used.
  const boundaries = [2n, 3n, 2n ** 32n, 2n ** 32n + 1n, 2n ** 53n + 1n, MAX_U64];
  for (const gross of boundaries) {
    const s = split(gross);
    assert.equal(s.legs[0].amountMinor + s.legs[1].amountMinor, gross, `boundary sum at gross=${gross}`);
  }
});
