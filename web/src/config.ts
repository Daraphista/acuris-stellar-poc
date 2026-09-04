/**
 * Every constant here is public Testnet information already committed in docs/evidence.md —
 * nothing secret lives in this file or anywhere else in web/. See docs/evidence.md for how
 * each value was independently confirmed.
 */
import { Networks } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/testnet";

export const PROVENANCE_CONTRACT_ID =
  "CCTYK4O5YMMCA2JYXVZRHDGKTJBBX56ALHRR3BBW32K4Y7RPCWBYFJ77";

// D1 demo payees — real, funded Testnet accounts (docs/evidence.md). Not secrets: these are
// public G... addresses. The settlement tab only ever sends money TO these; the account that
// SIGNS the transaction is a fresh, ephemeral keypair generated in the visitor's own tab.
export const ACURIS_PUBLIC_KEY = "GCNSHF5IZWGJ2G4TT5U2EQSC7BHGGZJ6M3WYQZA4IK5CURY6G55AI64D";
export const PARTNER_PUBLIC_KEY = "GBJ2NHWARQWMVZZI6V2P2VSXNV4WEFCFYOBRYK6JFV6BXO4QANQLZZTM";

// Used only as a read-only simulation source for the Provenance tab (never signs anything) —
// and a 404 loading it is the clearest available signal that Testnet has been reset.
export const SIMULATION_SOURCE_PUBLIC_KEY = ACURIS_PUBLIC_KEY;

/** Friendbot funds a fresh account with 10,000 XLM. Cap the demo well under that so a
 *  settlement never risks tripping the account's base reserve (op_underfunded). */
export const MAX_DEMO_GROSS_XLM = 1000;

/** Below this, a two-leg 50/50 split can't express two positive-amount payment operations. */
export const MIN_DEMO_GROSS_STROOPS = 2n;

export const KNOWN_BATCH_IDS = ["batch-0001-synthetic", "batch-0002-synthetic"] as const;

export function stellarExpertContractUrl(contractId: string): string {
  return `${STELLAR_EXPERT_BASE}/contract/${contractId}`;
}

export function stellarExpertTxUrl(hash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${hash}`;
}

export function stellarExpertAccountUrl(address: string): string {
  return `${STELLAR_EXPERT_BASE}/account/${address}`;
}
