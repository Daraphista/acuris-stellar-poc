import type { ProvenanceRecord } from "../lib/provenance.js";
import { stellarExpertAccountUrl } from "../config.js";
import { HashDisplay } from "./HashDisplay.js";

export function RecordView({ record }: { record: ProvenanceRecord }) {
  return (
    <div>
      <dl className="record-grid">
        <dt>batch_id</dt>
        <dd>{record.batchId}</dd>

        <dt>status</dt>
        <dd>
          <span className={`status-pill ${record.status}`}>{record.status}</span>
        </dd>

        <dt>terms_ref</dt>
        <dd>{record.termsRef}</dd>

        <dt>registered_at</dt>
        <dd>{record.registeredAt.toISOString()} (ledger time)</dd>

        <dt>registrar</dt>
        <dd>
          <a href={stellarExpertAccountUrl(record.registrar)} target="_blank" rel="noreferrer">
            {record.registrar}
          </a>
        </dd>

        <dt>supersedes</dt>
        <dd>{record.supersedesHex ?? "— (original registration)"}</dd>
      </dl>
      <div style={{ marginTop: "0.75rem" }}>
        <HashDisplay label="batch_hash" value={record.batchHashHex} />
      </div>
    </div>
  );
}
