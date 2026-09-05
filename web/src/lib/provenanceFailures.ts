/**
 * D2's two negative cases, run for real against the deployed contract.
 *
 * Both are *simulated* writes: `register` is attempted, the contract's guard rejects it, and the
 * transaction is never submitted. That is not a shortcut — it is where these guards actually fire.
 * Nothing reaches the ledger, so there is no transaction hash to link, and the absence of one is
 * itself the evidence that nothing was written.
 *
 * Because nothing is submitted, no secret key is involved. `require_auth()` only records an auth
 * requirement during simulation; the contract's own checks run regardless, which is what these
 * two cases exercise.
 */
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Address,
  nativeToScVal,
  xdr,
  rpc,
} from "@stellar/stellar-sdk";
import {
  PROVENANCE_CONTRACT_ID,
  SIMULATION_SOURCE_PUBLIC_KEY,
  SOROBAN_RPC_URL,
  ACURIS_PUBLIC_KEY,
  REGISTRAR_PUBLIC_KEY,
} from "../config.js";
import { CONTRACT_ERROR_NAMES, parseContractErrorCode } from "./contractErrors.js";
import { TestnetResetError } from "./provenance.js";

export interface FailureCaseOutcome {
  /** The contract error code the guard returned, e.g. 5. */
  code: number | undefined;
  /** Its name from the contract's own Error enum, e.g. "DuplicateRecord". */
  name: string;
  /** Horizon/RPC's raw error text, shown verbatim — a reviewer wants the real string. */
  raw: string;
  /** True when the call was rejected as intended. False means the guard did not fire, which is
   *  a finding in itself and must not be presented as a pass. */
  rejected: boolean;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function simulateRegister(args: {
  caller: string;
  batchId: string;
  batchHashHex: string;
  termsRef: string;
}): Promise<FailureCaseOutcome> {
  const server = new rpc.Server(SOROBAN_RPC_URL);

  let source;
  try {
    source = await server.getAccount(SIMULATION_SOURCE_PUBLIC_KEY);
  } catch {
    throw new TestnetResetError(
      "Could not load the demo's simulation account from Stellar Testnet. Testnet may have " +
        "been reset — see docs/runbook.md to confirm and redeploy if so.",
    );
  }

  const contract = new Contract(PROVENANCE_CONTRACT_ID);
  const encoder = new TextEncoder();

  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(
      contract.call(
        "register",
        new Address(args.caller).toScVal(),
        nativeToScVal(encoder.encode(args.batchId)),
        nativeToScVal(hexToBytes(args.batchHashHex), { type: "bytes" }),
        nativeToScVal(encoder.encode(args.termsRef)),
        // Option<BytesN<32>>::None — this is a fresh registration attempt, not a correction.
        xdr.ScVal.scvVoid(),
      ),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    const code = parseContractErrorCode(sim.error);
    return {
      code,
      name: code !== undefined ? (CONTRACT_ERROR_NAMES[code] ?? `unknown #${code}`) : "unknown",
      raw: sim.error,
      rejected: true,
    };
  }

  return {
    code: undefined,
    name: "no error",
    raw: "Simulation succeeded — the contract did not reject this call.",
    rejected: false,
  };
}

/**
 * Case 1 — duplicate registration. Attempts to register a `batch_hash` that is already on the
 * ledger, as the allow-listed registrar (the contract checks authorization *before* duplication,
 * so any other caller would produce #4 instead and prove the wrong thing).
 *
 * Expects `Error(Contract, #5)` DuplicateRecord.
 */
export async function runDuplicateRegistration(
  registeredBatchHashHex: string,
): Promise<FailureCaseOutcome> {
  return simulateRegister({
    caller: REGISTRAR_PUBLIC_KEY,
    batchId: "batch-0001-synthetic",
    batchHashHex: registeredBatchHashHex,
    termsRef: "terms/acuris-instawards-demo",
  });
}

/**
 * Case 2 — unauthorized registrar. Attempts a registration signed by the `acuris` address, which
 * is a real funded account but was never added to the admin-managed allow-list.
 *
 * Expects `Error(Contract, #4)` NotAuthorizedRegistrar. A valid signature proves control of a
 * key; it does not prove the signer is an authorized registrar, and this is where that
 * distinction is enforced.
 */
export async function runUnauthorizedRegistrar(): Promise<FailureCaseOutcome> {
  return simulateRegister({
    caller: ACURIS_PUBLIC_KEY,
    batchId: "batch-9999-unauthorized-probe",
    // A hash that is not registered, so the allow-list guard is unambiguously what rejects this.
    batchHashHex: "00".repeat(32),
    termsRef: "terms/acuris-instawards-demo",
  });
}
