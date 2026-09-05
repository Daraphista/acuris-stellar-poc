import { ErrorCallout, CalloutAction, ArchiveIcon, OfflineIcon } from "./ErrorCallout.js";
import { WarningIcon } from "./icons.js";
import {
  ContractSimulationError,
  RecordNotFoundError,
  RestoreRequiredError,
  TestnetResetError,
} from "../lib/provenance.js";
import { FriendbotError, SubmissionTimeoutError } from "../lib/settlementRail.js";
import { PROVENANCE_CONTRACT_ID, stellarExpertAccountUrl } from "../config.js";

const RUNBOOK_URL = "https://github.com/Daraphista/acuris-stellar-poc/blob/main/docs/runbook.md";

/**
 * Turns any error this app can produce into the right degraded state.
 *
 * Kept in one place so the same condition always looks the same wherever it surfaces, and so the
 * distinction that actually matters to a visitor is preserved: is this the environment (Testnet
 * reset, rate limit, RPC down), or is it a real answer from the contract (record not found)?
 */
export function NetworkErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof TestnetResetError) {
    return (
      <ErrorCallout
        tone="error"
        title="This contract no longer resolves"
        diagnostic={error.message}
        actions={
          <>
            <CalloutAction href={RUNBOOK_URL}>Redeployment runbook</CalloutAction>
            {onRetry ? <CalloutAction onClick={onRetry}>Retry</CalloutAction> : null}
          </>
        }
      >
        Contract <code className="text-primary">{PROVENANCE_CONTRACT_ID.slice(0, 8)}…</code> could
        not be reached on Testnet. Testnet is periodically reset, and no contract state or code
        survives a reset — so this is very likely an environment condition rather than a fault in
        the contract itself.
      </ErrorCallout>
    );
  }

  if (error instanceof RestoreRequiredError) {
    return (
      <ErrorCallout
        tone="warning"
        title="This record's state has been archived"
        icon={<ArchiveIcon size={16} />}
        diagnostic={error.message}
        actions={<CalloutAction href={RUNBOOK_URL}>State archival notes</CalloutAction>}
      >
        Soroban archives ledger entries that go untouched for long enough. The record still exists
        and its history is intact; it needs a restore before it can be read again.
      </ErrorCallout>
    );
  }

  if (error instanceof FriendbotError) {
    return (
      <ErrorCallout
        tone="warning"
        title="Testnet's Friendbot is rate-limited right now"
        diagnostic={error.message}
        actions={onRetry ? <CalloutAction onClick={onRetry}>Retry</CalloutAction> : undefined}
      >
        Friendbot funds the throwaway account this demo signs with, and it throttles under load.
        Nothing is wrong with the settlement rail — wait about a minute and run it again.
      </ErrorCallout>
    );
  }

  if (error instanceof SubmissionTimeoutError) {
    return (
      <ErrorCallout
        tone="warning"
        title="Submission timed out — it may still have gone through"
        diagnostic={error.message}
        actions={
          <CalloutAction href={stellarExpertAccountUrl(error.sourcePublicKey)}>
            Check the signing account
          </CalloutAction>
        }
      >
        Horizon stopped responding before it confirmed the transaction. Check the account's
        operations before retrying, so a settlement that actually landed is not submitted twice.
      </ErrorCallout>
    );
  }

  if (error instanceof RecordNotFoundError) {
    // Not a failure of the system: the contract answered, and the answer was "no such record".
    return (
      <ErrorCallout tone="warning" title="No record under that batch ID" icon={<WarningIcon size={16} />}>
        {error.message} Check for a typo, or try one of the known fixture IDs.
      </ErrorCallout>
    );
  }

  if (error instanceof ContractSimulationError) {
    return (
      <ErrorCallout tone="error" title="The contract rejected this read" diagnostic={error.message}>
        The call reached the contract and its guards refused it. The raw error is above.
      </ErrorCallout>
    );
  }

  if (error instanceof TypeError) {
    // fetch() rejects with TypeError on a network-layer failure, before any HTTP status exists.
    return (
      <ErrorCallout
        tone="error"
        title="Couldn't reach the network"
        icon={<OfflineIcon size={16} />}
        diagnostic={error.message}
        actions={onRetry ? <CalloutAction onClick={onRetry}>Retry</CalloutAction> : undefined}
      >
        The request failed before a response came back — a dropped connection, DNS, or an offline
        machine. This is a network condition, not a contract error.
      </ErrorCallout>
    );
  }

  return (
    <ErrorCallout
      tone="error"
      title="Something went wrong"
      diagnostic={error instanceof Error ? error.message : String(error)}
      actions={onRetry ? <CalloutAction onClick={onRetry}>Retry</CalloutAction> : undefined}
    >
      An unexpected error surfaced. Its raw text is above.
    </ErrorCallout>
  );
}
