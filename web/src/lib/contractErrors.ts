/**
 * Mirrors contracts/provenance/src/types.rs `Error` and scripts/src/stellar-cli.ts's
 * CONTRACT_ERROR_NAMES. Duplicated here rather than imported: scripts/ is a Node-only workspace
 * (it shells out via node:child_process), and importing from it would drag that into the
 * browser bundle. The contract itself is the source of truth for these values.
 */
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

/** Extracts a contract error code from a Soroban RPC simulation error string,
 *  e.g. "... Error(Contract, #6) ..." -> 6. Same shape whether it comes from the `stellar` CLI
 *  or from rpc.Api.SimulateTransactionErrorResponse.error. */
export function parseContractErrorCode(message: string): number | undefined {
  const match = message.match(/Error\(Contract,\s*#?(\d+)\)/);
  return match ? Number(match[1]) : undefined;
}

export function describeContractError(message: string): string {
  const code = parseContractErrorCode(message);
  if (code === undefined) return message;
  const name = CONTRACT_ERROR_NAMES[code];
  return name ? `${name} (contract error #${code})` : `unknown contract error #${code}`;
}
