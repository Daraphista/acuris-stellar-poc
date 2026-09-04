/**
 * D1 demo flow: generate an ephemeral Testnet keypair in this tab, fund it via Friendbot, split
 * a gross amount 50/50, build the one-transaction settlement, sign it with the ephemeral key,
 * and submit to Horizon. The security invariant: the secret key exists only in this module's
 * call stack and the Keypair object held in memory by the caller — it is never logged, never
 * written to storage, and never leaves this tab. See docs/architecture.md's "Instawards demo
 * variant" for how this differs from the Stellar-Wallets-Kit path the funded-sprint scope adds.
 */
import { Keypair, Horizon, Asset, Networks } from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";
import { settlementDigestAsync, toHex } from "@acuris-stellar-poc/canonical/browser";
import type { RevenueEvent } from "@acuris-stellar-poc/canonical/browser";
import { splitFiftyFifty, buildSettlementTransaction, type Split } from "@acuris-stellar-poc/settlement";
import { ACURIS_PUBLIC_KEY, PARTNER_PUBLIC_KEY, FRIENDBOT_URL, HORIZON_URL } from "../config.js";
import { withRetry } from "./retry.js";

export class FriendbotError extends Error {
  constructor(
    public readonly status: number,
    bodyText: string,
  ) {
    super(`Friendbot funding failed (HTTP ${status}): ${bodyText || "no response body"}`);
    this.name = "FriendbotError";
  }
}

export class SubmissionTimeoutError extends Error {
  constructor(public readonly sourcePublicKey: string) {
    super(
      "The submission timed out waiting for Horizon. The transaction may still have gone " +
        "through — check the ephemeral account's operations before retrying.",
    );
    this.name = "SubmissionTimeoutError";
  }
}

export interface SettlementResult {
  ephemeralPublicKey: string;
  digestHex: string;
  split: Split;
  transactionHash: string;
}

async function fundViaFriendbot(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new FriendbotError(response.status, body);
  }
}

function isNotFoundResponse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

/** Runs one full settlement: generates a throwaway keypair, funds it, splits `grossMinor`
 *  stroops of native XLM 50/50 between the real acuris/partner Testnet accounts, and submits
 *  the signed transaction. Reuses no state between calls — every call is a fresh keypair. */
export async function runSettlement(args: {
  grossMinor: bigint;
  event: RevenueEvent;
}): Promise<SettlementResult> {
  const keypair = Keypair.random();
  const horizon = new Horizon.Server(HORIZON_URL);

  await fundViaFriendbot(keypair.publicKey());

  // Friendbot returning success doesn't guarantee the account is visible on Horizon yet.
  const account = await withRetry(() => horizon.loadAccount(keypair.publicKey()), {
    attempts: 4,
    delayMs: 1500,
    retryOn: isNotFoundResponse,
  });

  const digest = await settlementDigestAsync(args.event);
  const split = splitFiftyFifty({
    grossMinor: args.grossMinor,
    acurisDestination: ACURIS_PUBLIC_KEY,
    partnerDestination: PARTNER_PUBLIC_KEY,
  });

  const tx: Transaction = buildSettlementTransaction({
    sourceAccount: account,
    split,
    settlementDigest: digest,
    asset: Asset.native(),
    networkPassphrase: Networks.TESTNET,
  });

  tx.sign(keypair);

  let response;
  try {
    response = await horizon.submitTransaction(tx);
  } catch (error) {
    if (isGatewayTimeout(error)) {
      throw new SubmissionTimeoutError(keypair.publicKey());
    }
    throw error;
  }

  return {
    ephemeralPublicKey: keypair.publicKey(),
    digestHex: toHex(digest),
    split,
    transactionHash: response.hash,
  };
}

function isGatewayTimeout(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  return status === 504 || status === 502;
}

/** Best-effort extraction of Horizon's own result_codes from a failed submission, for display
 *  alongside a human-readable message — a reviewer wants the raw code, not just our gloss. */
export function extractResultCodes(error: unknown): {
  transaction?: string;
  operations?: string[];
} | undefined {
  const data = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  if (data && typeof data === "object" && "extras" in data) {
    const extras = (data as { extras?: { result_codes?: { transaction?: string; operations?: string[] } } }).extras;
    return extras?.result_codes;
  }
  return undefined;
}
