import { ArrowDownIcon } from "./icons.js";
import { HashChip } from "./HashChip.js";
import { StatusPill, toneForRecordStatus } from "./StatusPill.js";
import { stellarExpertAccountUrl } from "../config.js";
import type { ProvenanceRecord } from "../lib/provenance.js";
import type { ProvenanceChain } from "../lib/provenanceChain.js";

function ChainNode({ record, index, isHead }: { record: ProvenanceRecord; index: number; isHead: boolean }) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-sm p-space-base ${
        isHead ? "border-2 border-secondary/50" : "border border-outline-variant"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-xs mb-space-sm border-b border-outline-variant">
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="font-code-compact text-code-compact text-outline uppercase">
            node {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-outline-variant select-none">/</span>
          <span className="font-title-sm text-title-sm text-primary truncate">
            {isHead ? "Current record" : index === 0 ? "Original registration" : "Correction"}
          </span>
        </div>
        <StatusPill tone={toneForRecordStatus(record.status)}>{record.status}</StatusPill>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-space-lg gap-y-space-xs">
        <div className="flex flex-col gap-space-xxs min-w-0">
          <dt className="font-code-micro text-code-micro text-outline uppercase tracking-wider">
            batch_hash
          </dt>
          <dd>
            <HashChip value={record.batchHashHex} label="batch_hash" />
          </dd>
        </div>
        <div className="flex flex-col gap-space-xxs min-w-0">
          <dt className="font-code-micro text-code-micro text-outline uppercase tracking-wider">
            registered_at
          </dt>
          <dd className="font-code-compact text-code-compact text-on-surface">
            {record.registeredAt.toISOString()}
            <span className="text-outline"> · ledger time</span>
          </dd>
        </div>
        <div className="flex flex-col gap-space-xxs min-w-0">
          <dt className="font-code-micro text-code-micro text-outline uppercase tracking-wider">
            registrar
          </dt>
          <dd>
            <HashChip
              value={record.registrar}
              href={stellarExpertAccountUrl(record.registrar)}
              label="registrar address"
            />
          </dd>
        </div>
        <div className="flex flex-col gap-space-xxs min-w-0">
          <dt className="font-code-micro text-code-micro text-outline uppercase tracking-wider">
            terms_ref
          </dt>
          <dd className="font-code-compact text-code-compact text-on-surface break-all">
            {record.termsRef}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-space-xs" aria-hidden>
      <span className="w-px h-5 bg-outline-variant" />
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container border border-outline-variant font-code-micro text-code-micro text-on-surface-variant">
        <ArrowDownIcon size={12} className="text-outline" />
        supersedes
      </span>
      <span className="w-px h-5 bg-outline-variant" />
    </div>
  );
}

/**
 * The supersession chain, oldest at top.
 *
 * This is the clearest evidence the registry behaves as claimed: each correction is a new record
 * pointing at the one it replaces, and the replaced records are still here, still readable. The
 * ledger makes that history tamper-evident — a change to any earlier record would no longer match
 * the digest recorded against it — which is a narrower claim than "immutable", and the accurate one.
 */
export function SupersessionChain({ chain, batchId }: { chain: ProvenanceChain; batchId: string }) {
  const { records } = chain;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-space-sm mb-space-base">
        <h2 className="font-headline-md text-headline-md text-primary">
          Supersession chain — <span className="font-code-default">{batchId}</span>
        </h2>
        <span className="font-code-micro text-code-micro text-outline">
          {records.length} record{records.length === 1 ? "" : "s"} ·{" "}
          {Math.max(0, records.length - 1)} supersedes link
          {records.length === 2 ? "" : "s"}
        </span>
      </div>

      {records.map((record, index) => (
        <div key={record.batchHashHex}>
          {index > 0 ? <Connector /> : null}
          <ChainNode
            record={record}
            index={index}
            isHead={index === records.length - 1}
          />
        </div>
      ))}

      {chain.truncated ? (
        <p className="mt-space-sm font-code-micro text-code-micro text-warning">
          Chain walk stopped early — more links exist than this view will follow.
        </p>
      ) : null}

      <p className="mt-space-base font-body-compact text-body-compact text-on-surface-variant">
        Nothing above was edited or deleted. Each correction is a new record pointing at the one it
        replaces, and every earlier record stays readable at its original hash.
      </p>
    </div>
  );
}
