import { Link } from "react-router-dom";
import { Panel, PanelHeader, DataRow, DataList } from "../components/Panel.js";
import { HashChip } from "../components/HashChip.js";
import { StatusPill } from "../components/StatusPill.js";
import { useAsync } from "../components/useAsync.js";
import { SpinnerIcon } from "../components/icons.js";
import { fetchLatestSettlement } from "../lib/horizonStatus.js";
import { lookupByBatchId } from "../lib/provenance.js";
import { walkSupersessionChain } from "../lib/provenanceChain.js";
import {
  NETWORK_PASSPHRASE,
  PROVENANCE_CONTRACT_ID,
  PROVENANCE_WASM_HASH,
  PROVENANCE_WASM_SIZE_BYTES,
  PROVENANCE_EXPORTED_FUNCTIONS,
  SOROBAN_SDK_VERSION,
  STELLAR_CLI_VERSION,
  KNOWN_BATCH_IDS,
  stellarExpertContractUrl,
  stellarExpertTxUrl,
} from "../config.js";

/** One tool's live summary. Loading and failure are first-class: a console that silently shows
 *  stale numbers through an outage is worse than one that says it couldn't reach the network. */
function ToolCard({
  title,
  to,
  cta,
  status,
  children,
}: {
  title: string;
  to: string;
  cta: string;
  status: "loading" | "ready" | "error";
  children: React.ReactNode;
}) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title={title}
        aside={
          status === "loading" ? (
            <SpinnerIcon size={12} className="text-outline" />
          ) : status === "error" ? (
            <StatusPill tone="warning">unreachable</StatusPill>
          ) : (
            <StatusPill tone="verified">live</StatusPill>
          )
        }
      />
      <div className="flex-1">{children}</div>
      <div className="px-space-base py-space-sm border-t border-outline-variant">
        <Link
          to={to}
          className="font-code-compact text-code-compact text-primary hover:underline"
        >
          {cta} →
        </Link>
      </div>
    </Panel>
  );
}

export function Index() {
  const settlement = useAsync(fetchLatestSettlement);
  const provenance = useAsync(async () => {
    const head = await lookupByBatchId(KNOWN_BATCH_IDS[0]);
    return { head, chain: await walkSupersessionChain(head) };
  });

  return (
    <>
      <header className="flex flex-col gap-space-xs">
        <h1 className="font-display-lg text-display-lg text-primary">Testnet console</h1>
        <p className="font-body-default text-body-default text-on-surface-variant max-w-2xl">
          Two internal rails, running live on Stellar Testnet: a revenue-share settlement rail and a
          clinical-data provenance registry. Everything below is fetched on load — nothing here is a
          recorded snapshot.
        </p>
      </header>

      <Panel>
        <PanelHeader title="Network" />
        <DataList>
          <DataRow label="network">{NETWORK_PASSPHRASE}</DataRow>
          <DataRow label="soroban-sdk">{SOROBAN_SDK_VERSION}</DataRow>
          <DataRow label="stellar-cli">{STELLAR_CLI_VERSION}</DataRow>
        </DataList>
      </Panel>

      <Panel>
        <PanelHeader title="Deployed contract" />
        <DataList>
          <DataRow label="contract">
            <HashChip
              value={PROVENANCE_CONTRACT_ID}
              full
              href={stellarExpertContractUrl(PROVENANCE_CONTRACT_ID)}
              label="contract address"
            />
          </DataRow>
          <DataRow
            label="wasm sha256"
            hint={`${PROVENANCE_WASM_SIZE_BYTES.toLocaleString()} bytes optimized`}
          >
            <HashChip value={PROVENANCE_WASM_HASH} label="WASM hash" />
          </DataRow>
          <DataRow label="exported fns">
            <span className="flex flex-wrap gap-space-xs">
              {PROVENANCE_EXPORTED_FUNCTIONS.map((name) => (
                <span
                  key={name}
                  className="px-1.5 py-0.5 rounded-sm border border-outline-variant bg-surface-container font-code-micro text-code-micro text-on-surface-variant"
                >
                  {name}
                </span>
              ))}
            </span>
          </DataRow>
        </DataList>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-normal">
        <ToolCard
          title="Settlement rail"
          to="/settlement"
          cta="Open settlement"
          status={settlement.status}
        >
          {settlement.status === "ready" && settlement.data ? (
            <DataList>
              <DataRow label="last tx">
                <HashChip
                  value={settlement.data.transactionHash}
                  href={stellarExpertTxUrl(settlement.data.transactionHash)}
                  label="transaction hash"
                />
              </DataRow>
              <DataRow label="ledger">{settlement.data.ledger}</DataRow>
              <DataRow label="settled at">{settlement.data.createdAt}</DataRow>
              <DataRow label="operations" hint="two payment legs, one transaction">
                {settlement.data.operationCount}
              </DataRow>
            </DataList>
          ) : settlement.status === "ready" ? (
            <p className="px-space-base py-space-sm font-body-compact text-body-compact text-on-surface-variant">
              No settlements recorded against the payee account yet.
            </p>
          ) : settlement.status === "error" ? (
            <p className="px-space-base py-space-sm font-body-compact text-body-compact text-on-surface-variant">
              Couldn't reach Horizon for the latest settlement. The rail itself is unaffected — open
              it to run one.
            </p>
          ) : (
            <p className="px-space-base py-space-sm font-code-micro text-code-micro text-outline">
              querying Horizon…
            </p>
          )}
        </ToolCard>

        <ToolCard
          title="Provenance registry"
          to="/provenance"
          cta="Open provenance"
          status={provenance.status}
        >
          {provenance.status === "ready" && provenance.data ? (
            <DataList>
              <DataRow label="head record">{provenance.data.head.batchId}</DataRow>
              <DataRow label="status">{provenance.data.head.status}</DataRow>
              <DataRow label="chain depth" hint="records · supersedes links">
                {provenance.data.chain.records.length} ·{" "}
                {Math.max(0, provenance.data.chain.records.length - 1)}
              </DataRow>
              <DataRow label="registered at">
                {provenance.data.head.registeredAt.toISOString()}
              </DataRow>
            </DataList>
          ) : provenance.status === "error" ? (
            <p className="px-space-base py-space-sm font-body-compact text-body-compact text-on-surface-variant">
              Couldn't read the contract. Testnet may have been reset — open provenance for the full
              diagnostic.
            </p>
          ) : (
            <p className="px-space-base py-space-sm font-code-micro text-code-micro text-outline">
              simulating a read against the contract…
            </p>
          )}
        </ToolCard>
      </div>
    </>
  );
}
