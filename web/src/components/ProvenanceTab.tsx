import { useState } from "react";
import {
  lookupByBatchId,
  RecordNotFoundError,
  RestoreRequiredError,
  TestnetResetError,
  ContractSimulationError,
  type ProvenanceRecord,
} from "../lib/provenance.js";
import { PROVENANCE_CONTRACT_ID, KNOWN_BATCH_IDS, stellarExpertContractUrl } from "../config.js";
import { Callout } from "./Callout.js";
import { HashDisplay } from "./HashDisplay.js";
import { RecordView } from "./RecordView.js";
import { DigestCalculator } from "./DigestCalculator.js";

type LookupState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; record: ProvenanceRecord }
  | { phase: "error"; message: string; kind: "not-found" | "reset" | "restore" | "other" };

export function ProvenanceTab() {
  const [batchId, setBatchId] = useState<string>(KNOWN_BATCH_IDS[0]);
  const [state, setState] = useState<LookupState>({ phase: "idle" });

  async function runLookup(id: string) {
    setState({ phase: "loading" });
    try {
      const record = await lookupByBatchId(id);
      setState({ phase: "success", record });
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        setState({ phase: "error", message: error.message, kind: "not-found" });
      } else if (error instanceof TestnetResetError) {
        setState({ phase: "error", message: error.message, kind: "reset" });
      } else if (error instanceof RestoreRequiredError) {
        setState({ phase: "error", message: error.message, kind: "restore" });
      } else if (error instanceof ContractSimulationError) {
        setState({ phase: "error", message: error.message, kind: "other" });
      } else if (error instanceof TypeError) {
        setState({
          phase: "error",
          kind: "other",
          message: "Network request failed — check your connection. (Not a CORS error: this endpoint allows browser access.)",
        });
      } else {
        setState({ phase: "error", kind: "other", message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Look up a provenance record</h2>
        <p className="hint">
          Reads directly from the live, deployed Soroban contract — nothing is signed or
          submitted, this is a read-only simulation.
        </p>
        <HashDisplay
          label="contract"
          value={PROVENANCE_CONTRACT_ID}
          href={stellarExpertContractUrl(PROVENANCE_CONTRACT_ID)}
        />

        <div className="field" style={{ marginTop: "0.9rem" }}>
          <label htmlFor="batch-id">batch_id</label>
          <input
            id="batch-id"
            type="text"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
          <div className="chip-buttons">
            {KNOWN_BATCH_IDS.map((id) => (
              <button key={id} type="button" className="chip-button" onClick={() => setBatchId(id)}>
                {id}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="primary"
          disabled={state.phase === "loading" || batchId.trim().length === 0}
          onClick={() => runLookup(batchId.trim())}
        >
          {state.phase === "loading" ? (
            <>
              <span className="spinner" /> Looking up…
            </>
          ) : (
            "Look up on-chain"
          )}
        </button>

        {state.phase === "error" && (
          <div style={{ marginTop: "1rem" }}>
            <Callout kind={state.kind === "not-found" ? "warning" : "error"}>{state.message}</Callout>
          </div>
        )}

        {state.phase === "success" && (
          <div style={{ marginTop: "1rem" }}>
            <RecordView record={state.record} />
          </div>
        )}
      </div>

      <div className="card">
        <h2>Digest calculator</h2>
        <DigestCalculator compareToHex={state.phase === "success" ? state.record.batchHashHex : undefined} />
      </div>
    </div>
  );
}
