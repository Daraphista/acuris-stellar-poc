import { useState } from "react";
import { Panel, PanelHeader, DataRow, DataList } from "../components/Panel.js";
import { HashChip } from "../components/HashChip.js";
import { StatusPill, toneForRecordStatus } from "../components/StatusPill.js";
import { NetworkErrorState } from "../components/NetworkErrorState.js";
import { SupersessionChain } from "../components/SupersessionChain.js";
import { DigestCalculator } from "../components/DigestCalculator.js";
import { FailureCasePanel, type LiveFailureCase } from "../components/FailureCasePanel.js";
import { SpinnerIcon } from "../components/icons.js";
import { lookupByBatchId, type ProvenanceRecord } from "../lib/provenance.js";
import { walkSupersessionChain, type ProvenanceChain } from "../lib/provenanceChain.js";
import {
  runDuplicateRegistration,
  runUnauthorizedRegistrar,
  type FailureCaseOutcome,
} from "../lib/provenanceFailures.js";
import {
  KNOWN_BATCH_IDS,
  PROVENANCE_CONTRACT_ID,
  stellarExpertAccountUrl,
  stellarExpertContractUrl,
} from "../config.js";

export function Provenance() {
  const [batchId, setBatchId] = useState<string>(KNOWN_BATCH_IDS[0]);
  const [record, setRecord] = useState<ProvenanceRecord | undefined>();
  const [chain, setChain] = useState<ProvenanceChain | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();

  const [cases, setCases] = useState<Record<string, LiveFailureCase["result"]>>({});
  const [runningCase, setRunningCase] = useState<string | undefined>();

  async function lookup(id: string = batchId) {
    setLoading(true);
    setError(undefined);
    setChain(undefined);
    try {
      const found = await lookupByBatchId(id.trim());
      setRecord(found);
      // The chain walk is a separate concern: if it fails, the record itself is still good.
      try {
        setChain(await walkSupersessionChain(found));
      } catch {
        setChain(undefined);
      }
    } catch (lookupError) {
      setRecord(undefined);
      setError(lookupError);
    } finally {
      setLoading(false);
    }
  }

  async function runCase(id: string) {
    setRunningCase(id);
    const toResult = (outcome: FailureCaseOutcome) => ({
      code: outcome.code !== undefined ? `Error(Contract, #${outcome.code}) ${outcome.name}` : outcome.name,
      source: "contract",
      detail: outcome.rejected
        ? "Rejected at simulation — nothing was written to the ledger, so there is no transaction hash to show."
        : outcome.raw,
      rejected: outcome.rejected,
    });

    try {
      const outcome =
        id === "duplicate"
          ? await runDuplicateRegistration(
              // Uses whichever hash is currently registered, so this stays correct as the chain grows.
              record?.batchHashHex ?? (await lookupByBatchId(KNOWN_BATCH_IDS[0])).batchHashHex,
            )
          : await runUnauthorizedRegistrar();
      setCases((prev) => ({ ...prev, [id]: toResult(outcome) }));
    } catch (caseError) {
      setCases((prev) => ({
        ...prev,
        [id]: {
          code: "could not run",
          source: "network",
          detail: caseError instanceof Error ? caseError.message : String(caseError),
          rejected: false,
        },
      }));
    } finally {
      setRunningCase(undefined);
    }
  }

  const liveCases: LiveFailureCase[] = [
    {
      id: "duplicate",
      name: "Duplicate registration",
      description: "Re-registers an existing batch_hash as the allow-listed registrar.",
      state: runningCase === "duplicate" ? "running" : cases.duplicate ? "done" : "idle",
      result: cases.duplicate,
    },
    {
      id: "unauthorized",
      name: "Unauthorized registrar",
      description: "Registers as the acuris account, which is not on the allow-list.",
      state: runningCase === "unauthorized" ? "running" : cases.unauthorized ? "done" : "idle",
      result: cases.unauthorized,
    },
  ];

  return (
    <>
      <header className="flex flex-col gap-space-xs">
        <h1 className="font-display-lg text-display-lg text-primary">Provenance registry</h1>
        <p className="font-body-default text-body-default text-on-surface-variant max-w-2xl">
          Records a tamper-evident digest of a de-identified clinical batch on Stellar. Only opaque
          identifiers, a SHA-256 digest and a ledger timestamp ever go on chain — never the manifest,
          never the underlying data.
        </p>
      </header>

      <Panel>
        <PanelHeader
          title="Look up a record"
          aside={
            <HashChip
              value={PROVENANCE_CONTRACT_ID}
              href={stellarExpertContractUrl(PROVENANCE_CONTRACT_ID)}
              label="contract address"
            />
          }
        />
        <div className="p-space-base flex flex-col gap-space-sm">
          <div className="flex flex-wrap items-end gap-space-sm">
            <div className="flex flex-col gap-space-xs min-w-0 flex-1 max-w-md">
              <label
                className="font-code-micro text-code-micro uppercase tracking-wider text-outline"
                htmlFor="batch-id"
              >
                batch_id
              </label>
              <input
                id="batch-id"
                value={batchId}
                onChange={(changeEvent) => setBatchId(changeEvent.target.value)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === "Enter") void lookup();
                }}
                className="h-8 px-space-sm bg-surface-dim border border-outline-variant rounded-sm font-code-default text-code-default text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={loading || !batchId.trim()}
              onClick={() => void lookup()}
              className="h-8 px-space-base bg-primary text-on-primary font-body-compact text-body-compact font-medium rounded-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-space-xs"
            >
              {loading ? <SpinnerIcon size={12} /> : null}
              {loading ? "Looking up…" : "Look up on-chain"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="font-code-micro text-code-micro text-outline">known fixtures:</span>
            {KNOWN_BATCH_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setBatchId(id);
                  void lookup(id);
                }}
                className={`px-2 py-0.5 rounded-sm border font-code-micro text-code-micro transition-colors cursor-pointer ${
                  batchId === id
                    ? "border-primary text-primary bg-surface-container"
                    : "border-outline-variant text-on-surface-variant hover:text-primary hover:border-outline bg-surface-container-low"
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <p className="font-code-micro text-code-micro text-outline">
            Read-only simulation against the deployed contract — nothing is signed or submitted.
          </p>
        </div>
      </Panel>

      {error ? <NetworkErrorState error={error} onRetry={() => void lookup()} /> : null}

      {record ? (
        <Panel>
          <PanelHeader
            title="On-chain record"
            aside={<StatusPill tone={toneForRecordStatus(record.status)}>{record.status}</StatusPill>}
          />
          <DataList>
            <DataRow label="batch_id">{record.batchId}</DataRow>
            <DataRow label="batch_hash">
              <HashChip value={record.batchHashHex} label="batch_hash" />
            </DataRow>
            <DataRow label="terms_ref">{record.termsRef}</DataRow>
            <DataRow label="registered_at" hint="set by the contract, not the caller">
              {record.registeredAt.toISOString()}
            </DataRow>
            <DataRow label="registrar">
              <HashChip
                value={record.registrar}
                href={stellarExpertAccountUrl(record.registrar)}
                label="registrar address"
              />
            </DataRow>
            <DataRow label="supersedes">
              {record.supersedesHex ? (
                <HashChip value={record.supersedesHex} label="superseded batch_hash" />
              ) : (
                <span className="text-outline">— original registration</span>
              )}
            </DataRow>
          </DataList>
        </Panel>
      ) : null}

      {record ? (
        <Panel>
          <PanelHeader title="Verify the hash yourself" />
          <div className="p-space-base">
            <DigestCalculator compareToHex={record.batchHashHex} />
          </div>
        </Panel>
      ) : null}

      {chain && chain.records.length > 1 ? (
        <Panel>
          <div className="p-space-base">
            <SupersessionChain chain={chain} batchId={record?.batchId ?? batchId} />
          </div>
        </Panel>
      ) : null}

      <FailureCasePanel
        title="Failure cases"
        framing={
          <>
            Both cases below attempt a real write against the deployed contract and are refused by
            its own guards at simulation, before submission. Nothing reaches the ledger, so there is
            no transaction hash to link — that absence is the evidence.
          </>
        }
        liveCases={liveCases}
        onRun={(id) => void runCase(id)}
      />
    </>
  );
}
