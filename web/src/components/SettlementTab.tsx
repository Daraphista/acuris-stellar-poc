import { useState } from "react";
import { parseDecimalToMinor, AmountError, SplitError, SettlementTransactionError } from "@acuris-stellar-poc/settlement";
import type { RevenueEvent } from "@acuris-stellar-poc/canonical/browser";
import {
  runSettlement,
  extractResultCodes,
  FriendbotError,
  SubmissionTimeoutError,
  type SettlementResult,
} from "../lib/settlementRail.js";
import { MAX_DEMO_GROSS_XLM, stellarExpertTxUrl, stellarExpertAccountUrl } from "../config.js";
import { Callout } from "./Callout.js";
import { HashDisplay } from "./HashDisplay.js";

type RunState =
  | { phase: "idle" }
  | { phase: "running"; step: string }
  | { phase: "success"; result: SettlementResult; event: RevenueEvent }
  | { phase: "error"; message: string };

function nowAsCanonicalTimestamp(): string {
  // RevenueEvent.occurredAt requires RFC3339 UTC, second precision, literal 'Z' — strip the
  // milliseconds Date#toISOString() always includes.
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function SettlementTab() {
  const [grossXlm, setGrossXlm] = useState("10");
  const [state, setState] = useState<RunState>({ phase: "idle" });

  let grossMinor: bigint | null = null;
  let inputError: string | null = null;
  try {
    grossMinor = parseDecimalToMinor(grossXlm);
    if (grossMinor > BigInt(MAX_DEMO_GROSS_XLM) * 10_000_000n) {
      inputError = `Capped at ${MAX_DEMO_GROSS_XLM} XLM for this demo — Friendbot funds a fresh account with 10,000 XLM total, and it needs headroom for the base reserve and fees.`;
      grossMinor = null;
    } else if (grossMinor < 2n) {
      inputError = "Must be at least 0.0000002 XLM (2 stroops) — a 50/50 split needs two positive amounts.";
      grossMinor = null;
    }
  } catch (e) {
    inputError = e instanceof AmountError ? e.message : String(e);
  }

  async function run() {
    if (grossMinor === null) return;
    const event: RevenueEvent = {
      eventId: `evt_demo_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
      source: "instawards-demo",
      assetCode: "XLM",
      grossAmountMinor: grossMinor.toString(),
      occurredAt: nowAsCanonicalTimestamp(),
      partnerRef: "e-konsulta-medical-clinic",
    };

    setState({ phase: "running", step: "Generating an ephemeral Testnet keypair…" });
    try {
      setState({ phase: "running", step: "Funding via Friendbot, then waiting for Horizon to see it…" });
      const result = await runSettlement({ grossMinor, event });
      setState({ phase: "success", result, event });
    } catch (error) {
      setState({ phase: "error", message: describeError(error) });
    }
  }

  return (
    <div>
      <Callout kind="info">
        Testnet only. A throwaway keypair is generated in this browser tab, funded by Friendbot,
        and used to sign one transaction — it is never written to storage and is discarded on
        refresh. No Mainnet, no real funds.
      </Callout>

      <div className="card">
        <h2>Run a settlement</h2>
        <p className="hint">
          Splits a simulated revenue event 50/50 and pays it out in one atomic Testnet
          transaction to the real acuris and partner accounts documented in{" "}
          <code>docs/evidence.md</code>.
        </p>

        <div className="field">
          <label htmlFor="gross-xlm">Gross amount (XLM)</label>
          <input
            id="gross-xlm"
            type="text"
            inputMode="decimal"
            value={grossXlm}
            onChange={(e) => setGrossXlm(e.target.value)}
          />
          {inputError && <div className="hint" style={{ color: "var(--amber)" }}>{inputError}</div>}
        </div>

        <button
          type="button"
          className="primary"
          disabled={grossMinor === null || state.phase === "running"}
          onClick={run}
        >
          {state.phase === "running" ? (
            <>
              <span className="spinner" /> {state.step}
            </>
          ) : (
            "Run split on Testnet"
          )}
        </button>

        {state.phase === "error" && (
          <div style={{ marginTop: "1rem" }}>
            <Callout kind="error">{state.message}</Callout>
          </div>
        )}

        {state.phase === "success" && (
          <div style={{ marginTop: "1rem" }}>
            <Callout kind="success">Settlement landed on Testnet.</Callout>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <HashDisplay
                label="transaction"
                value={state.result.transactionHash}
                href={stellarExpertTxUrl(state.result.transactionHash)}
              />
              <HashDisplay
                label="ephemeral signer"
                value={state.result.ephemeralPublicKey}
                href={stellarExpertAccountUrl(state.result.ephemeralPublicKey)}
              />
              <HashDisplay label="settlement_digest" value={state.result.digestHex} />
            </div>
            <dl className="record-grid" style={{ marginTop: "0.75rem" }}>
              <dt>acuris leg</dt>
              <dd>{formatXlm(state.result.split.legs[0].amountMinor)} XLM</dd>
              <dt>partner leg</dt>
              <dd>{formatXlm(state.result.split.legs[1].amountMinor)} XLM</dd>
              {state.result.split.remainderMinor > 0n && (
                <>
                  <dt>remainder</dt>
                  <dd>{state.result.split.remainderMinor.toString()} stroop, on the partner leg</dd>
                </>
              )}
            </dl>
            <p className="hint" style={{ marginTop: "0.6rem" }}>
              The memo on that transaction is exactly <code>settlement_digest</code> above — open
              it on stellar.expert and compare the two payment amounts against the split shown
              here, and the memo (base64) against this hex digest.
            </p>
            <details style={{ marginTop: "0.5rem" }}>
              <summary style={{ cursor: "pointer", color: "var(--blue-light)", fontSize: "0.82rem" }}>
                Copy the event JSON (rederive the digest yourself via packages/canonical)
              </summary>
              <pre style={{ fontSize: "0.72rem", overflowX: "auto", background: "var(--navy-dark)", padding: "0.6rem", borderRadius: "6px" }}>
                {JSON.stringify(state.event, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function formatXlm(minor: bigint): string {
  const whole = minor / 10_000_000n;
  const frac = (minor % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${frac}`;
}

function describeError(error: unknown): string {
  if (error instanceof FriendbotError) {
    return `Testnet Friendbot is rate-limited or unavailable (HTTP ${error.status}). Wait about a minute and try again.`;
  }
  if (error instanceof SubmissionTimeoutError) {
    return error.message;
  }
  if (error instanceof SplitError || error instanceof SettlementTransactionError) {
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Network request failed — check your connection. (Not a CORS error: every endpoint this demo uses allows browser access.)";
  }
  const codes = extractResultCodes(error);
  if (codes) {
    const opCodes = codes.operations && codes.operations.length > 0 ? ` (operations: ${codes.operations.join(", ")})` : "";
    return `Horizon rejected the transaction: ${codes.transaction}${opCodes}`;
  }
  return error instanceof Error ? error.message : String(error);
}
