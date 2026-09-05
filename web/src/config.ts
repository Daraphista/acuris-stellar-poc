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

/** Deployment facts, all from docs/evidence.md. Static because they describe the build that
 *  produced the deployed contract, not live ledger state — a reviewer can check them against
 *  `stellar contract info` or the explorer. */
export const PROVENANCE_WASM_HASH =
  "5d5096d703b69a1fb63740ca75b5fe8e301ba3488839967268b55b503f336f3e";
export const PROVENANCE_WASM_SIZE_BYTES = 8047;
export const PROVENANCE_EXPORTED_FUNCTIONS = [
  "get",
  "get_by_batch_id",
  "init",
  "register",
  "revoke",
  "set_registrar",
] as const;
export const SOROBAN_SDK_VERSION = "27.0.6";
export const STELLAR_CLI_VERSION = "28.0.0";

// D1 demo payees — real, funded Testnet accounts (docs/evidence.md). Not secrets: these are
// public G... addresses. The settlement tab only ever sends money TO these; the account that
// SIGNS the transaction is a fresh, ephemeral keypair generated in the visitor's own tab.
export const ACURIS_PUBLIC_KEY = "GCNSHF5IZWGJ2G4TT5U2EQSC7BHGGZJ6M3WYQZA4IK5CURY6G55AI64D";
export const PARTNER_PUBLIC_KEY = "GBJ2NHWARQWMVZZI6V2P2VSXNV4WEFCFYOBRYK6JFV6BXO4QANQLZZTM";

// Used only as a read-only simulation source for the Provenance tab (never signs anything) —
// and a 404 loading it is the clearest available signal that Testnet has been reset.
export const SIMULATION_SOURCE_PUBLIC_KEY = ACURIS_PUBLIC_KEY;

// The allow-listed registrar (docs/evidence.md). Public key only — this demo never holds its
// secret and never submits anything signed by it; it appears here so the duplicate-registration
// failure case can be simulated as the one caller the contract *would* otherwise accept.
export const REGISTRAR_PUBLIC_KEY = "GD6LSNZIY3A6VU2IICGUZYODKZZZO2GEO74ZUO3K3SK2PGUZ5EV66OJL";

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

/** The command the success screen hands a visitor so they can confirm the memo against Horizon
 *  without trusting anything this page rendered. There is no D1 verification script yet
 *  (scripts/settle.ts is funded-sprint scope), so a raw Horizon query is the honest path. */
export function horizonVerifyCommand(txHash: string): string {
  return `curl -s ${HORIZON_URL}/transactions/${txHash} | jq -r .memo`;
}

export function horizonTransactionUrl(txHash: string): string {
  return `${HORIZON_URL}/transactions/${txHash}`;
}
