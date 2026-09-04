import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { Account, Asset, Networks } from "@stellar/stellar-sdk";
import { settlementDigest, toHex, type RevenueEvent } from "@acuris-stellar-poc/canonical";

import { splitFiftyFifty } from "../src/split.js";
import { buildSettlementTransaction } from "../src/transaction.js";
import { SettlementTransactionError } from "../src/errors.js";
import { formatMinorAsDecimal } from "../src/amounts.js";

// Real, funded Testnet accounts (see docs/evidence.md).
const ACURIS = "GCNSHF5IZWGJ2G4TT5U2EQSC7BHGGZJ6M3WYQZA4IK5CURY6G55AI64D";
const PARTNER = "GBJ2NHWARQWMVZZI6V2P2VSXNV4WEFCFYOBRYK6JFV6BXO4QANQLZZTM";

function freshSourceAccount(): Account {
  return new Account(ACURIS, "100");
}

function vectorsPath(filename: string): URL {
  return new URL(`../../../../fixtures/vectors/${filename}`, import.meta.url);
}

test("buildSettlementTransaction: exactly 2 payment ops matching the split, native asset", () => {
  const split = splitFiftyFifty({ grossMinor: 100n, acurisDestination: ACURIS, partnerDestination: PARTNER });
  const digest = new Uint8Array(32).fill(7);
  const tx = buildSettlementTransaction({
    sourceAccount: freshSourceAccount(),
    split,
    settlementDigest: digest,
    asset: Asset.native(),
    networkPassphrase: Networks.TESTNET,
  });

  assert.equal(tx.operations.length, 2);
  split.legs.forEach((leg, i) => {
    const op = tx.operations[i];
    assert.equal(op.type, "payment");
    if (op.type !== "payment") throw new Error("unreachable");
    assert.equal(op.destination, leg.destination);
    assert.equal(op.amount, formatMinorAsDecimal(leg.amountMinor));
    assert.ok(op.asset.isNative());
  });
});

test("buildSettlementTransaction: memo is MEMO_HASH of exactly the supplied digest", () => {
  const split = splitFiftyFifty({ grossMinor: 100n, acurisDestination: ACURIS, partnerDestination: PARTNER });
  const digest = new Uint8Array(32);
  for (let i = 0; i < 32; i++) digest[i] = i;
  const tx = buildSettlementTransaction({
    sourceAccount: freshSourceAccount(),
    split,
    settlementDigest: digest,
    asset: Asset.native(),
    networkPassphrase: Networks.TESTNET,
  });
  assert.equal(tx.memo.type, "hash");
  // Compare via hex, not assert.deepEqual — Node's strict-equal treats Buffer and Uint8Array
  // instances as different types even with identical bytes, and memo.value's concrete
  // constructor isn't part of the documented contract.
  assert.equal(toHex(tx.memo.value as Uint8Array), toHex(digest));
});

test("buildSettlementTransaction: vector-driven — digest always matches; memo matches when payable", () => {
  // Every vector's digest must match regardless of amount — canonicalization validates a
  // generic u64 field, unrelated to whether the amount could ever be paid on classic Stellar.
  // Only the subset that's actually *payable* (see MAX_PAYMENT_MINOR in transaction.ts — a
  // classic payment amount is a SIGNED int64, one bit narrower than u64) gets built into a
  // real transaction here.
  const raw = readFileSync(vectorsPath("settlement-vectors.json"), "utf8");
  const vectors: { name: string; event: RevenueEvent; expected_digest_hex: string }[] =
    JSON.parse(raw);
  const built: string[] = [];
  const skippedAsUnpayable: string[] = [];

  for (const v of vectors) {
    const digest = settlementDigest(v.event);
    assert.equal(toHex(digest), v.expected_digest_hex, `${v.name}: digest matches pinned vector`);

    const grossMinor = BigInt(v.event.grossAmountMinor as string);
    if (grossMinor < 2n) continue; // can't express as two positive-amount legs — see split.ts

    const split = splitFiftyFifty({ grossMinor, acurisDestination: ACURIS, partnerDestination: PARTNER });
    if (split.legs.some((leg) => leg.amountMinor > 9223372036854775807n)) {
      // e.g. the max-u64 vector: its remainder leg lands one unit past int64 max. A valid
      // digest input is not necessarily a payable amount — see buildSettlementTransaction.
      skippedAsUnpayable.push(v.name);
      continue;
    }

    const tx = buildSettlementTransaction({
      sourceAccount: freshSourceAccount(),
      split,
      settlementDigest: digest,
      asset: Asset.native(),
      networkPassphrase: Networks.TESTNET,
    });

    assert.equal(toHex(tx.memo.value as Uint8Array), v.expected_digest_hex, `${v.name}: on-chain memo`);
    built.push(v.name);
  }

  assert.ok(built.length > 0, "at least one vector must be both splittable and payable");
  assert.ok(skippedAsUnpayable.includes("max-u64-amount-edge-case"), "the known unpayable vector must be seen and explicitly skipped, not silently absent");
});

test("buildSettlementTransaction: rejects a leg amount past the classic-ledger int64 ceiling", () => {
  // 2^64-1 split 50/50: the remainder leg is exactly 2^63, one past MAX_PAYMENT_MINOR (2^63-1).
  const split = splitFiftyFifty({
    grossMinor: 18446744073709551615n,
    acurisDestination: ACURIS,
    partnerDestination: PARTNER,
  });
  assert.throws(
    () =>
      buildSettlementTransaction({
        sourceAccount: freshSourceAccount(),
        split,
        settlementDigest: new Uint8Array(32),
        asset: Asset.native(),
        networkPassphrase: Networks.TESTNET,
      }),
    SettlementTransactionError,
  );
});

test("buildSettlementTransaction: rejects a digest that isn't exactly 32 bytes", () => {
  const split = splitFiftyFifty({ grossMinor: 100n, acurisDestination: ACURIS, partnerDestination: PARTNER });
  const build = (len: number) =>
    buildSettlementTransaction({
      sourceAccount: freshSourceAccount(),
      split,
      settlementDigest: new Uint8Array(len),
      asset: Asset.native(),
      networkPassphrase: Networks.TESTNET,
    });
  assert.throws(() => build(31), SettlementTransactionError);
  assert.throws(() => build(33), SettlementTransactionError);
});

test("buildSettlementTransaction: deterministic — identical inputs produce the same operations, fee, and memo", () => {
  // Deliberately NOT a raw toXdr() comparison: setTimeout() bakes in a wall-clock-derived
  // maxTime, so two builds a second apart would legitimately differ there — that's correct
  // behavior, not nondeterminism in anything this function actually controls. What must be
  // stable given identical inputs is everything else: fee, operations, and memo.
  const split = splitFiftyFifty({ grossMinor: 100n, acurisDestination: ACURIS, partnerDestination: PARTNER });
  const digest = new Uint8Array(32).fill(9);
  const build = () =>
    buildSettlementTransaction({
      sourceAccount: new Account(ACURIS, "100"), // fresh instance, same starting sequence
      split,
      settlementDigest: digest,
      asset: Asset.native(),
      networkPassphrase: Networks.TESTNET,
    });
  const a = build();
  const b = build();

  assert.equal(a.fee, b.fee);
  assert.equal(toHex(a.memo.value as Uint8Array), toHex(b.memo.value as Uint8Array));
  assert.equal(a.operations.length, b.operations.length);
  a.operations.forEach((opA, i) => {
    const opB = b.operations[i];
    assert.equal(opA.type, opB.type);
    if (opA.type !== "payment" || opB.type !== "payment") throw new Error("unreachable");
    assert.equal(opA.destination, opB.destination);
    assert.equal(opA.amount, opB.amount);
  });
});
