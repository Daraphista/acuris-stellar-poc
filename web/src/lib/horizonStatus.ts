/**
 * Live status for the console index.
 *
 * The index used to be the natural place to hardcode "what we achieved" from the evidence doc.
 * It doesn't, because a frozen snapshot cannot tell a visitor whether the system works *now* —
 * and would keep claiming success through a Testnet reset. Everything here is fetched on load.
 */
import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL, ACURIS_PUBLIC_KEY } from "../config.js";

export interface LatestSettlement {
  transactionHash: string;
  ledger: number;
  createdAt: string;
  /** MEMO_HASH as Horizon reports it, hex-encoded, or null if the transaction carried no memo. */
  memoHex: string | null;
  operationCount: number;
}

function base64ToHex(base64: string): string {
  const binary = atob(base64);
  let hex = "";
  for (let i = 0; i < binary.length; i += 1) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * The most recent transaction involving the acuris payee account — i.e. the last settlement that
 * actually landed, whoever ran it. Returns null when the account exists but has no transactions,
 * which is a real state (a freshly redeployed Testnet) and not an error.
 */
export async function fetchLatestSettlement(): Promise<LatestSettlement | null> {
  const horizon = new Horizon.Server(HORIZON_URL);

  const page = await horizon
    .transactions()
    .forAccount(ACURIS_PUBLIC_KEY)
    .order("desc")
    .limit(1)
    .call();

  const record = page.records[0];
  if (!record) return null;

  return {
    transactionHash: record.hash,
    ledger: record.ledger_attr,
    createdAt: record.created_at,
    memoHex: record.memo ? base64ToHex(record.memo) : null,
    operationCount: record.operation_count,
  };
}
