/**
 * D1's negative cases, run for real.
 *
 * Two layers reject things here, and the panel distinguishes them because they mean different
 * things: a `client` rejection means the split engine or transaction builder refused to construct
 * something invalid, and nothing was ever sent. A `horizon` rejection means a fully-formed, signed
 * transaction was submitted to Stellar Testnet and the network refused it — the stronger of the
 * two, because it is the network's verdict rather than ours.
 *
 * The network cases share one throwaway probe account, funded once per page session, because
 * Friendbot is rate-limited and there is no reason to burn three fundings on three assertions.
 */
import {
  Keypair,
  Horizon,
  Account,
  Asset,
  Networks,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
} from "@stellar/stellar-sdk";
import {
  splitFiftyFifty,
  buildSettlementTransaction,
  SplitError,
  SettlementTransactionError,
} from "@acuris-stellar-poc/settlement";
import { ACURIS_PUBLIC_KEY, PARTNER_PUBLIC_KEY, FRIENDBOT_URL, HORIZON_URL } from "../config.js";
import { extractResultCodes, FriendbotError } from "./settlementRail.js";
import { withRetry } from "./retry.js";

export type FailureLayer = "client" | "horizon";

export interface SettlementFailureOutcome {
  /** The rejection code itself, e.g. "op_underfunded" or "SplitError". */
  code: string;
  layer: FailureLayer;
  /** One line of context — what was attempted and what the layer said about it. */
  detail: string;
  /** False means the case did *not* fail as expected. That is a finding, not a pass. */
  rejected: boolean;
}

const DEMO_DIGEST = new Uint8Array(32).fill(0);

function localAccount(): Account {
  // Sequence number is irrelevant: these two cases never reach the network.
  return new Account(ACURIS_PUBLIC_KEY, "0");
}

/** A gross of 1 stroop cannot be expressed as two positive payment operations, so the split
 *  engine refuses before a transaction exists. */
export function runBelowMinimumSplit(): SettlementFailureOutcome {
  try {
    splitFiftyFifty({
      grossMinor: 1n,
      acurisDestination: ACURIS_PUBLIC_KEY,
      partnerDestination: PARTNER_PUBLIC_KEY,
    });
    return {
      code: "no error",
      layer: "client",
      detail: "The split engine accepted a 1-stroop gross, which it should not.",
      rejected: false,
    };
  } catch (error) {
    return {
      code: error instanceof SplitError ? "SplitError" : "unexpected error",
      layer: "client",
      detail: error instanceof Error ? error.message : String(error),
      rejected: error instanceof SplitError,
    };
  }
}

/** A gross whose halves exceed what a signed int64 payment amount can express. The digest is
 *  perfectly valid; classic Stellar simply cannot carry the amount. */
export function runInt64Overflow(): SettlementFailureOutcome {
  const overflowingGross = 2n * 9223372036854775808n;
  try {
    const split = splitFiftyFifty({
      grossMinor: overflowingGross,
      acurisDestination: ACURIS_PUBLIC_KEY,
      partnerDestination: PARTNER_PUBLIC_KEY,
    });
    buildSettlementTransaction({
      sourceAccount: localAccount(),
      split,
      settlementDigest: DEMO_DIGEST,
      asset: Asset.native(),
      networkPassphrase: Networks.TESTNET,
    });
    return {
      code: "no error",
      layer: "client",
      detail: "The builder accepted a leg amount larger than int64, which it should not.",
      rejected: false,
    };
  } catch (error) {
    const expected = error instanceof SettlementTransactionError || error instanceof SplitError;
    return {
      code: error instanceof SettlementTransactionError ? "SettlementTransactionError" : "SplitError",
      layer: "client",
      detail: error instanceof Error ? error.message : String(error),
      rejected: expected,
    };
  }
}

let probeKeypair: Keypair | undefined;

/** What `loadAccount` hands back — an `Account` plus Horizon's own extra fields. Named here so
 *  the builder callbacks below can be typed without pretending it is a bare `Account`. */
type LoadedAccount = Awaited<ReturnType<Horizon.Server["loadAccount"]>>;

/** Creates and funds one throwaway account for the network-level cases, reused for the rest of
 *  the session. Its secret never leaves this module, and it is discarded on reload. */
async function probeAccount(): Promise<{ keypair: Keypair; account: LoadedAccount }> {
  const horizon = new Horizon.Server(HORIZON_URL);

  if (!probeKeypair) {
    const keypair = Keypair.random();
    const response = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(keypair.publicKey())}`);
    if (!response.ok) {
      throw new FriendbotError(response.status, await response.text().catch(() => ""));
    }
    probeKeypair = keypair;
  }

  const account = await withRetry(() => horizon.loadAccount(probeKeypair!.publicKey()), {
    attempts: 4,
    delayMs: 1500,
    retryOn: (error) =>
      (error as { response?: { status?: number } })?.response?.status === 404,
  });

  return { keypair: probeKeypair, account };
}

async function submitExpectingRejection(
  build: (account: LoadedAccount) => ReturnType<TransactionBuilder["build"]>,
  sign: (tx: ReturnType<TransactionBuilder["build"]>, keypair: Keypair) => void,
  attempted: string,
): Promise<SettlementFailureOutcome> {
  const horizon = new Horizon.Server(HORIZON_URL);
  const { keypair, account } = await probeAccount();

  const tx = build(account);
  sign(tx, keypair);

  try {
    const response = await horizon.submitTransaction(tx);
    return {
      code: "accepted",
      layer: "horizon",
      detail: `Horizon accepted the transaction (${response.hash}). It should have rejected it.`,
      rejected: false,
    };
  } catch (error) {
    const codes = extractResultCodes(error);
    const code = codes?.operations?.find((entry) => entry !== "op_success") ?? codes?.transaction;
    return {
      code: code ?? "rejected",
      layer: "horizon",
      detail: codes
        ? `${attempted} — Horizon returned ${codes.transaction ?? "an error"}${
            codes.operations?.length ? ` (operations: ${codes.operations.join(", ")})` : ""
          }.`
        : `${attempted} — ${error instanceof Error ? error.message : String(error)}`,
      rejected: true,
    };
  }
}

/** Pays out far more than the probe account holds. Expects `op_underfunded`. */
export async function runInsufficientBalance(): Promise<SettlementFailureOutcome> {
  return submitExpectingRejection(
    (account) =>
      new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(
          Operation.payment({
            destination: ACURIS_PUBLIC_KEY,
            asset: Asset.native(),
            amount: "100000000",
          }),
        )
        .addMemo(Memo.hash(DEMO_DIGEST))
        .setTimeout(60)
        .build(),
    (tx, keypair) => tx.sign(keypair),
    "Attempted to pay 100,000,000 XLM from an account funded with 10,000",
  );
}

/** Builds a transaction whose time bounds already closed. Expects `tx_too_late`. */
export async function runExpiredTimeBounds(): Promise<SettlementFailureOutcome> {
  const closedAt = Math.floor(Date.now() / 1000) - 600;
  return submitExpectingRejection(
    (account) =>
      new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
        timebounds: { minTime: 0, maxTime: closedAt },
      })
        .addOperation(
          Operation.payment({
            destination: ACURIS_PUBLIC_KEY,
            asset: Asset.native(),
            amount: "1",
          }),
        )
        .addMemo(Memo.hash(DEMO_DIGEST))
        .build(),
    (tx, keypair) => tx.sign(keypair),
    "Submitted a transaction whose time bounds expired ten minutes ago",
  );
}

/** Signs against the public network's passphrase and submits to Testnet, so the signature cannot
 *  verify. Expects `tx_bad_auth`. This is the case that shows why the passphrase is part of what
 *  gets signed, not just a client-side setting. */
export async function runWrongNetworkPassphrase(): Promise<SettlementFailureOutcome> {
  return submitExpectingRejection(
    (account) =>
      new TransactionBuilder(account, {
        fee: BASE_FEE,
        // Deliberately wrong: this transaction is destined for Testnet.
        networkPassphrase: Networks.PUBLIC,
      })
        .addOperation(
          Operation.payment({
            destination: ACURIS_PUBLIC_KEY,
            asset: Asset.native(),
            amount: "1",
          }),
        )
        .addMemo(Memo.hash(DEMO_DIGEST))
        .setTimeout(60)
        .build(),
    (tx, keypair) => tx.sign(keypair),
    "Signed with the public network passphrase and submitted to Testnet",
  );
}
