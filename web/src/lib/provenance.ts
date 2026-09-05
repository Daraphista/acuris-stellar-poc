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

/** Loads the account every read-only simulation needs as its source. A 404 here is the clearest
 *  available signal that Testnet was reset out from under the demo, so it gets its own error. */
async function simulationSource() {
  const rpcServer = server();
  try {
    return await rpcServer.getAccount(SIMULATION_SOURCE_PUBLIC_KEY);
  } catch {
    throw new TestnetResetError(
      "Could not load the demo's simulation account from Stellar Testnet. Testnet may have " +
        "been reset — see docs/runbook.md to confirm and redeploy if so.",
    );
  }
}

/** Runs one read-only contract call and decodes the record it returns. `notFoundLabel` is what
 *  the caller was looking for, used only to phrase a RecordNotFound error. */
async function simulateRead(
  functionName: "get" | "get_by_batch_id",
  argument: ReturnType<typeof nativeToScVal>,
  notFoundLabel: string,
): Promise<ProvenanceRecord> {
  const rpcServer = server();
  const source = await simulationSource();

  const contract = new Contract(PROVENANCE_CONTRACT_ID);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(contract.call(functionName, argument))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);

  if (rpc.Api.isSimulationRestore(sim)) {
    throw new RestoreRequiredError();
  }
  if (rpc.Api.isSimulationError(sim)) {
    const code = parseContractErrorCode(sim.error);
    if (code === 6 /* RecordNotFound */) throw new RecordNotFoundError(notFoundLabel);
    throw new ContractSimulationError(sim.error);
  }
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error("Unexpected simulation response shape from Soroban RPC.");
  }

  return toRecord(scValToNative(sim.result.retval) as Record<string, unknown>);
}

/**
 * Looks up a batch by its human-readable batch_id (e.g. "batch-0001-synthetic"). The secondary
 * index tracks corrections, so this resolves to the newest record in a supersession chain, not
 * the first one registered.
 */
export async function lookupByBatchId(batchId: string): Promise<ProvenanceRecord> {
  return simulateRead("get_by_batch_id", nativeToScVal(new TextEncoder().encode(batchId)), batchId);
}

/**
 * Looks up a single record by its `batch_hash` — the contract's primary key. Needed to walk a
 * `supersedes` chain backwards, since each link points at a hash rather than a batch_id.
 */
export async function getByHash(batchHashHex: string): Promise<ProvenanceRecord> {
  return simulateRead("get", nativeToScVal(hexToBytes(batchHashHex), { type: "bytes" }), batchHashHex);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new Error(`Not a hex string: "${hex}"`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
