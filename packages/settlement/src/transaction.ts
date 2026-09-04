/**
 * Builds the one unsigned classic transaction that carries a settlement: two payment
 * operations (the split's legs, in order) plus a MEMO_HASH tying the transaction back to the
 * off-chain revenue event it settles. Atomic by construction — both operations are in one
 * transaction, so either both legs land or neither does.
 *
 * `settlementDigest` is an INPUT here, not computed in this module — computing it means
 * choosing between node:crypto (sync) and WebCrypto (async), and this module has no opinion on
 * that; the caller (a Node script or the browser demo) picks whichever @acuris-stellar-poc/canonical
 * entry point matches its runtime and passes the resulting bytes in. Only `import type` is used
 * for anything from canonical, so no node:* specifier ever enters this module's runtime graph.
 */
import { TransactionBuilder, Operation, Memo, BASE_FEE } from "@stellar/stellar-sdk";
import type { Asset, Transaction, TransactionSource } from "@stellar/stellar-sdk";
import { formatMinorAsDecimal } from "./amounts.js";
import type { Split } from "./split.js";
import { SettlementTransactionError } from "./errors.js";

export interface BuildSettlementTransactionArgs {
  /** Account | Horizon's AccountResponse | anything else implementing TransactionSource */
  sourceAccount: TransactionSource;
  split: Split;
  /** exactly 32 bytes */
  settlementDigest: Uint8Array;
  asset: Asset;
  networkPassphrase: string;
  /** max fee this transaction is willing to pay PER OPERATION, in stroops. Default: 10x
   *  BASE_FEE, a hedge against Testnet surge pricing (2 ops * 1000 stroops = 0.0002 XLM). */
  baseFeeStroops?: string;
  timeoutSeconds?: number;
}

const DEFAULT_TIMEOUT_SECONDS = 180;
const DEFAULT_FEE_MULTIPLIER = 10;

/**
 * Stellar's classic ledger stores an amount as a SIGNED int64 count of minor units — not
 * unsigned, despite `grossAmountMinor` elsewhere in this repo (docs/canonicalization.md,
 * split.ts) validating against the full u64 range like any other generic integer field. A
 * split's remainder leg can land exactly one unit past this ceiling (2^63) even though the
 * gross itself was a valid u64 — that's a real boundary, not an edge case worth silently
 * clamping. ~922 billion XLM; unreachable by any real settlement here, but caught explicitly
 * so the failure reads as "too large to pay," not a cryptic SDK decimal-places TypeError.
 */
const MAX_PAYMENT_MINOR = 9223372036854775807n; // 2^63 - 1

/** ONE transaction: 2 payment ops (acuris leg first, partner leg second) + MEMO_HASH. Unsigned
 *  — signing is the caller's job. Throws if settlementDigest isn't exactly 32 bytes, or if a
 *  leg's amount exceeds what a classic Stellar payment can express. */
export function buildSettlementTransaction(args: BuildSettlementTransactionArgs): Transaction {
  if (args.settlementDigest.length !== 32) {
    throw new SettlementTransactionError(
      `settlementDigest must be exactly 32 bytes, got ${args.settlementDigest.length}`,
    );
  }

  for (const leg of args.split.legs) {
    if (leg.amountMinor > MAX_PAYMENT_MINOR) {
      throw new SettlementTransactionError(
        `${leg.role} leg amount (${leg.amountMinor} minor units) exceeds the maximum a ` +
          `classic Stellar payment can express (${MAX_PAYMENT_MINOR}, i.e. 2^63-1)`,
      );
    }
  }

  const feePerOp = args.baseFeeStroops ?? String(Number(BASE_FEE) * DEFAULT_FEE_MULTIPLIER);

  const builder = new TransactionBuilder(args.sourceAccount, {
    fee: feePerOp,
    networkPassphrase: args.networkPassphrase,
  });

  for (const leg of args.split.legs) {
    builder.addOperation(
      Operation.payment({
        destination: leg.destination,
        asset: args.asset,
        amount: formatMinorAsDecimal(leg.amountMinor),
      }),
    );
  }

  builder.addMemo(Memo.hash(args.settlementDigest));
  builder.setTimeout(args.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS);

  return builder.build();
}
