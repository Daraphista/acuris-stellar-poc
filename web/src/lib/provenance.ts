/**
 * D2 read path: looks up a batch_id on the live provenance contract by read-only Soroban RPC
 * simulation. Nothing here signs or submits anything — `get_by_batch_id` and `get` are
 * unauthenticated reads (see docs/authorization.md), so this only ever simulates.
 *
 * The `Status` unit enum shape below (`["Active"]`, an array wrapping one string, not a bare
 * string) was confirmed empirically against the live contract during development, not
 * guessed — see the git history for this file's introduction.
 */
import { Contract, TransactionBuilder, BASE_FEE, Networks, nativeToScVal, scValToNative, rpc } from "@stellar/stellar-sdk";
import { toHex } from "@acuris-stellar-poc/canonical/browser";
import { PROVENANCE_CONTRACT_ID, SIMULATION_SOURCE_PUBLIC_KEY, SOROBAN_RPC_URL } from "../config.js";
import { describeContractError, parseContractErrorCode } from "./contractErrors.js";

export interface ProvenanceRecord {
  batchId: string;
  batchHashHex: string;
  termsRef: string;
  registeredAt: Date;
  registrar: string;
  supersedesHex: string | null;
  status: "Active" | "Superseded" | "Revoked" | string;
}

export class TestnetResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestnetResetError";
  }
}

export class RecordNotFoundError extends Error {
  constructor(batchId: string) {
    super(`No record is registered under batch_id "${batchId}".`);
    this.name = "RecordNotFoundError";
  }
}

export class RestoreRequiredError extends Error {
  constructor() {
    super(
      "This record's ledger entry has expired out of active state (Soroban state archival) " +
        "and needs restoring before it can be read again.",
    );
    this.name = "RestoreRequiredError";
  }
}

export class ContractSimulationError extends Error {
  constructor(rawMessage: string) {
    super(describeContractError(rawMessage));
    this.name = "ContractSimulationError";
  }
}

function normalizeStatus(rawStatus: unknown): string {
  // Soroban's unit-variant contracttype enums decode to a one-element array wrapping the
  // variant name (e.g. ["Active"]), not a bare string — confirmed against the live contract.
  if (Array.isArray(rawStatus)) return String(rawStatus[0]);
  return String(rawStatus);
}

function toRecord(raw: Record<string, unknown>): ProvenanceRecord {
  const registeredAtSeconds = raw.registered_at as bigint;
  return {
    batchId: new TextDecoder().decode(raw.batch_id as Uint8Array),
    batchHashHex: toHex(raw.batch_hash as Uint8Array),
    termsRef: new TextDecoder().decode(raw.terms_ref as Uint8Array),
    registeredAt: new Date(Number(registeredAtSeconds) * 1000),
    registrar: raw.registrar as string,
    supersedesHex: raw.supersedes ? toHex(raw.supersedes as Uint8Array) : null,
    status: normalizeStatus(raw.status),
  };
}

let cachedServer: InstanceType<typeof rpc.Server> | undefined;
function server(): InstanceType<typeof rpc.Server> {
  if (!cachedServer) cachedServer = new rpc.Server(SOROBAN_RPC_URL);
  return cachedServer;
}

/**
 * Looks up a batch by its human-readable batch_id (e.g. "batch-0001-synthetic") against the
 * live contract. Simulation needs *a* source account even for a read-only call — this uses the
 * known-funded acuris address rather than a null/placeholder account, because a 404 loading
 * that account is the clearest possible signal that Testnet has been reset out from under the
 * demo, and this function turns that specific case into a message that says so.
 */
export async function lookupByBatchId(batchId: string): Promise<ProvenanceRecord> {
  const rpcServer = server();

  let source;
  try {
    source = await rpcServer.getAccount(SIMULATION_SOURCE_PUBLIC_KEY);
  } catch (error) {
    throw new TestnetResetError(
      "Could not load the demo's simulation account from Stellar Testnet. Testnet may have " +
        "been reset — see docs/runbook.md to confirm and redeploy if so.",
    );
  }

  const contract = new Contract(PROVENANCE_CONTRACT_ID);
  const op = contract.call("get_by_batch_id", nativeToScVal(new TextEncoder().encode(batchId)));
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);

  if (rpc.Api.isSimulationRestore(sim)) {
    throw new RestoreRequiredError();
  }
  if (rpc.Api.isSimulationError(sim)) {
    const code = parseContractErrorCode(sim.error);
    if (code === 6 /* RecordNotFound */) throw new RecordNotFoundError(batchId);
    throw new ContractSimulationError(sim.error);
  }
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error("Unexpected simulation response shape from Soroban RPC.");
  }

  const raw = scValToNative(sim.result.retval) as Record<string, unknown>;
  return toRecord(raw);
}
