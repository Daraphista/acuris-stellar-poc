/**
 * Thin, safe wrapper around the `stellar` CLI. We shell out to the CLI rather than build
 * transactions with the JS SDK directly — it's already a documented prerequisite (see
 * docs/runbook.md), and reusing it here means these scripts exercise the exact same signing
 * and submission path a reviewer would use by hand, rather than a second, parallel one.
 *
 * Uses spawnSync with an argv array throughout — never string-interpolate CLI arguments into
 * a shell command.
 */
import { spawnSync } from "node:child_process";

// Mirrors contracts/provenance/src/types.rs `Error`. Kept here only to turn a raw
// `Error(Contract, #N)` CLI failure into a readable name for script output — the contract
// itself is the source of truth for these values.
export const CONTRACT_ERROR_NAMES: Record<number, string> = {
  1: "NotInitialized",
  2: "AlreadyInitialized",
  3: "NotAdmin",
  4: "NotAuthorizedRegistrar",
  5: "DuplicateRecord",
  6: "RecordNotFound",
  7: "SupersedesNotFound",
  8: "SupersedesNotActive",
};

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `missing required environment variable: ${name} (see .env.example, and run npm run setup:accounts)`,
    );
  }
  return value;
}

export function network(): string {
  return process.env.STELLAR_NETWORK ?? "testnet";
}

export interface InvokeResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Runs `stellar contract invoke --id <id> --source <identity> --network <net> -- <args...>` */
export function invoke(args: {
  contractId: string;
  sourceIdentity: string;
  args: string[];
}): InvokeResult {
  const argv = [
    "contract",
    "invoke",
    "--id",
    args.contractId,
    "--source",
    args.sourceIdentity,
    "--network",
    network(),
    "--",
    ...args.args,
  ];
  const result = spawnSync("stellar", argv, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`failed to run 'stellar' CLI: ${result.error.message}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

/** Extracts a contract error code from CLI stderr, e.g. "Error(Contract, #5)" -> 5. */
export function parseContractErrorCode(stderr: string): number | undefined {
  const match = stderr.match(/Error\(Contract,\s*#?(\d+)\)/);
  return match ? Number(match[1]) : undefined;
}

export function hexEncode(utf8: string): string {
  return Buffer.from(utf8, "utf8").toString("hex");
}
