import { useState } from "react";
import { Panel, PanelHeader } from "../components/Panel.js";
import { HashChip } from "../components/HashChip.js";
import { StepRail, type Step, type StepState } from "../components/StepRail.js";
import { CodeBlock } from "../components/CodeBlock.js";
import { Disclosure } from "../components/Disclosure.js";
import { StatusPill } from "../components/StatusPill.js";
import { NetworkErrorState } from "../components/NetworkErrorState.js";
import {
  FailureCasePanel,
  type LiveFailureCase,
  type PendingFailureCase,
} from "../components/FailureCasePanel.js";
import { CheckIcon, SpinnerIcon } from "../components/icons.js";
import {
  runSettlement,
  confirmMemoOnChain,
  type SettlementResult,
  type OnChainConfirmation,
} from "../lib/settlementRail.js";
import {
  runBelowMinimumSplit,
  runInt64Overflow,
  runInsufficientBalance,
  runExpiredTimeBounds,
  runWrongNetworkPassphrase,
  type SettlementFailureOutcome,
} from "../lib/failureCases.js";
import {
  ACURIS_PUBLIC_KEY,
  PARTNER_PUBLIC_KEY,
  MAX_DEMO_GROSS_XLM,
  MIN_DEMO_GROSS_STROOPS,
  horizonVerifyCommand,
  stellarExpertAccountUrl,
  stellarExpertTxUrl,
} from "../config.js";
import {
  parseDecimalToMinor,
  formatMinorAsDecimal,
  splitFiftyFifty,
  AmountError,
} from "@acuris-stellar-poc/settlement";
import type { RevenueEvent } from "@acuris-stellar-poc/canonical/browser";

const STROOPS_PER_XLM = 10_000_000n;

/** Builds the event this settlement is *about*. Field names and formats follow
 *  docs/canonicalization.md exactly — the digest is only reproducible if they do. */
function buildRevenueEvent(grossMinor: bigint): RevenueEvent {
  return {
    eventId: `evt_demo_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
    source: "instawards-demo",
    assetCode: "XLM",
    grossAmountMinor: grossMinor.toString(),
    occurredAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    partnerRef: "e-konsulta-medical-clinic",
  };
}

type Phase = "idle" | "running" | "done" | "failed";

const PENDING_CASES: PendingFailureCase[] = [
  {
    id: "trustline",
    name: "Missing trustline",
    note: "blocked on the testanchor SRT asset — the demo pays in native XLM (Week 1–2 scope)",
  },
  {
    id: "replay",
    name: "Duplicate event_id replay",
    note: "no replay guard implemented yet (Week 3 scope)",
  },
  {
    id: "rejected-signature",
    name: "User-rejected signature",
    note: "requires the Freighter / Wallets Kit signer path (Week 1 scope)",
  },
];

export function Settlement() {
  const [grossInput, setGrossInput] = useState("10");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [event, setEvent] = useState<RevenueEvent | undefined>();
  const [result, setResult] = useState<SettlementResult | undefined>();
  const [confirmation, setConfirmation] = useState<OnChainConfirmation | undefined>();
  const [confirmationError, setConfirmationError] = useState(false);
  const [error, setError] = useState<unknown>();

  const [cases, setCases] = useState<Record<string, LiveFailureCase["result"]>>({});
  const [runningCase, setRunningCase] = useState<string | undefined>();

  // Validate on every keystroke so the split preview below is always about what's typed.
  let grossMinor: bigint | null = null;
  let validationError: string | undefined;
  try {
    const parsed = parseDecimalToMinor(grossInput);
    if (parsed < MIN_DEMO_GROSS_STROOPS) {
      validationError = "A 50/50 split needs two positive amounts — minimum 2 stroops.";
    } else if (parsed > BigInt(MAX_DEMO_GROSS_XLM) * STROOPS_PER_XLM) {
      validationError = `Demo cap is ${MAX_DEMO_GROSS_XLM} XLM — Friendbot funds the throwaway account with 10,000 and it needs headroom for reserve and fees.`;
    } else {
      grossMinor = parsed;
    }
  } catch (parseError) {
    validationError =
      parseError instanceof AmountError ? parseError.message : "Enter a positive decimal amount.";
  }

  const preview = grossMinor
    ? splitFiftyFifty({
        grossMinor,
        acurisDestination: ACURIS_PUBLIC_KEY,
        partnerDestination: PARTNER_PUBLIC_KEY,
      })
    : undefined;

  async function run() {
    if (!grossMinor) return;

    const revenueEvent = buildRevenueEvent(grossMinor);
    setEvent(revenueEvent);
    setPhase("running");
    setError(undefined);
    setResult(undefined);
    setConfirmation(undefined);
    setConfirmationError(false);
    setStepStates({ event: "done", keypair: "active" });

    try {
      // runSettlement owns the network sequence; the rail reflects the phases it moves through.
      setStepStates({ event: "done", keypair: "done", fund: "active" });
      const settlement = await runSettlement({ grossMinor, event: revenueEvent });

      setStepStates({ event: "done", keypair: "done", fund: "done", split: "done", submit: "done" });
      setResult(settlement);
      setPhase("done");

      // Independent read-back. Best-effort: a failure here doesn't undo the settlement.
      try {
        setConfirmation(await confirmMemoOnChain(settlement.transactionHash));
      } catch {
        setConfirmationError(true);
      }
    } catch (runError) {
      setStepStates((prev) => ({ ...prev, fund: "failed" }));
      setError(runError);
      setPhase("failed");
    }
  }

  const steps: Step[] = [
    {
      id: "event",
      label: "Build revenue event",
      state: stepStates.event ?? "pending",
      detail: event ? <>event_id {event.eventId}</> : undefined,
    },
    {
      id: "keypair",
      label: "Generate ephemeral Testnet keypair",
      state: stepStates.keypair ?? "pending",
      detail: result ? <>{result.ephemeralPublicKey}</> : undefined,
    },
    {
      id: "fund",
      label: "Fund via Friendbot",
      state: stepStates.fund ?? "pending",
      note: "waiting for Horizon to see the new account — retries up to 4 times",
    },
    {
      id: "split",
      label: "Compute digest and split",
      state: stepStates.split ?? "pending",
      detail: result ? (
        <>
          acuris {formatMinorAsDecimal(result.split.legs[0].amountMinor)} · partner {formatMinorAsDecimal(result.split.legs[1].amountMinor)}
        </>
      ) : undefined,
    },
    {
      id: "submit",
      label: "Sign and submit",
      state: stepStates.submit ?? "pending",
      detail: result ? <>ledger {result.ledger}</> : undefined,
    },
  ];

  const memoMatches =
    result && confirmation?.memoHex ? confirmation.memoHex === result.digestHex : undefined;

  const liveCases: LiveFailureCase[] = [
    {
      id: "below-minimum",
      name: "Amount below 2 stroops",
      description: "A gross that cannot be split into two positive payments.",
      state: runningCase === "below-minimum" ? "running" : cases["below-minimum"] ? "done" : "idle",
      result: cases["below-minimum"],
    },
    {
      id: "int64",
      name: "Leg exceeds int64",
      description: "A valid digest input whose legs are larger than a payment amount can express.",
      state: runningCase === "int64" ? "running" : cases.int64 ? "done" : "idle",
      result: cases.int64,
    },
    {
      id: "underfunded",
      name: "Insufficient balance",
      description: "Submits a payment larger than the funded probe account holds.",
      state: runningCase === "underfunded" ? "running" : cases.underfunded ? "done" : "idle",
      result: cases.underfunded,
    },
    {
      id: "too-late",
      name: "Expired time bounds",
      description: "Submits a signed transaction whose time bounds closed ten minutes ago.",
      state: runningCase === "too-late" ? "running" : cases["too-late"] ? "done" : "idle",
      result: cases["too-late"],
    },
    {
      id: "passphrase",
      name: "Wrong network passphrase",
      description: "Signs against the public network, submits to Testnet.",
      state: runningCase === "passphrase" ? "running" : cases.passphrase ? "done" : "idle",
      result: cases.passphrase,
    },
  ];

  async function runCase(id: string) {
    setRunningCase(id);
    const toResult = (outcome: SettlementFailureOutcome) => ({
      code: outcome.code,
      source: outcome.layer === "client" ? "client" : "Horizon",
      detail: outcome.detail,
      rejected: outcome.rejected,
    });

    try {
      let outcome: SettlementFailureOutcome;
      if (id === "below-minimum") outcome = runBelowMinimumSplit();
      else if (id === "int64") outcome = runInt64Overflow();
      else if (id === "underfunded") outcome = await runInsufficientBalance();
      else if (id === "too-late") outcome = await runExpiredTimeBounds();
      else outcome = await runWrongNetworkPassphrase();

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

  return (
    <>
      <header className="flex flex-col gap-space-xs">
        <h1 className="font-display-lg text-display-lg text-primary">Settlement rail</h1>
        <p className="font-body-default text-body-default text-on-surface-variant max-w-2xl">
          Splits a revenue event 50/50 and pays both legs in one atomic Stellar transaction, with
          the event's SHA-256 digest carried as the transaction memo. Either both legs settle or
          neither does.
        </p>
      </header>

      {phase === "idle" || phase === "failed" ? (
        <Panel>
          <PanelHeader title="New settlement" />
          <div className="p-space-base flex flex-col gap-space-base">
            <div className="flex flex-col gap-space-xs max-w-sm">
              <label
                className="font-code-micro text-code-micro uppercase tracking-wider text-outline"
                htmlFor="gross"
              >
                Gross amount (XLM)
              </label>
              <input
                id="gross"
                inputMode="decimal"
                value={grossInput}
                onChange={(changeEvent) => setGrossInput(changeEvent.target.value)}
                className="h-8 px-space-sm bg-surface-dim border border-outline-variant rounded-sm font-code-default text-code-default text-primary focus:border-primary focus:outline-none"
              />
              {validationError ? (
                <p className="font-code-micro text-code-micro text-warning">{validationError}</p>
              ) : (
                <p className="font-code-micro text-code-micro text-outline">
                  7 decimal places · 1 stroop precision
                </p>
              )}
            </div>

            {preview ? (
              <div className="border border-outline-variant rounded-sm">
                <div className="px-space-sm py-space-xs border-b border-outline-variant flex items-center justify-between">
                  <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline">
                    Split preview
                  </span>
                  <span className="font-code-micro text-code-micro text-outline">
                    computed locally, nothing sent
                  </span>
                </div>
                <table className="w-full font-code-compact text-code-compact">
                  <tbody className="divide-y divide-outline-variant">
                    <tr>
                      <td className="px-space-sm py-space-xs text-on-surface">acuris</td>
                      <td className="px-space-sm py-space-xs text-right text-primary">
                        {formatMinorAsDecimal(preview.legs[0].amountMinor)} XLM
                      </td>
                    </tr>
                    <tr>
                      <td className="px-space-sm py-space-xs text-on-surface">partner</td>
                      <td className="px-space-sm py-space-xs text-right text-primary">
                        {formatMinorAsDecimal(preview.legs[1].amountMinor)} XLM
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="flex flex-col gap-space-xs">
              <button
                type="button"
                disabled={!grossMinor}
                onClick={() => void run()}
                className="h-9 px-space-base bg-primary text-on-primary font-body-default text-body-default font-medium rounded-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-start inline-flex items-center gap-space-xs"
              >
                Run split on Testnet
              </button>
              <p className="font-code-micro text-code-micro text-outline">
                Generates a throwaway keypair in this tab, funds it via Friendbot, builds one atomic
                two-leg transaction, signs it, and submits it. The secret key never leaves this tab
                and is discarded on reload.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {phase === "running" ? (
        <Panel>
          <StepRail steps={steps} />
        </Panel>
      ) : null}

      {phase === "failed" && error ? (
        <NetworkErrorState error={error} onRetry={() => void run()} />
      ) : null}

      {phase === "done" && result ? (
        <>
          <div className="flex items-center gap-space-sm">
            <StatusPill tone="verified">
              <CheckIcon size={11} />
              Settled
            </StatusPill>
            <span className="font-code-compact text-code-compact text-on-surface-variant">
              ledger {result.ledger}
              {confirmation ? ` · ${confirmation.createdAt}` : ""}
            </span>
          </div>

          <Panel>
            <PanelHeader
              title="Memo integrity"
              aside={
                memoMatches === true ? (
                  <StatusPill tone="verified">verified match</StatusPill>
                ) : memoMatches === false ? (
                  <StatusPill tone="error">mismatch</StatusPill>
                ) : (
                  <StatusPill tone="warning">not read back</StatusPill>
                )
              }
            />
            <div className="p-space-base grid grid-cols-1 md:grid-cols-2 gap-space-base">
              <div className="flex flex-col gap-space-xxs">
                <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline">
                  settlement_digest — computed in this tab
                </span>
                <span className="font-code-default text-code-default text-primary break-all select-all">
                  {result.digestHex}
                </span>
              </div>
              <div className="flex flex-col gap-space-xxs">
                <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline">
                  memo — read back from Horizon
                </span>
                <span className="font-code-default text-code-default text-primary break-all select-all">
                  {confirmation?.memoHex ??
                    (confirmationError ? "could not re-read from Horizon" : "reading…")}
                </span>
              </div>
            </div>
            <p className="px-space-base pb-space-base font-body-compact text-body-compact text-on-surface-variant">
              {memoMatches === true
                ? "The two sides come from different places: the left is the digest this tab computed from the event below, the right is what Horizon reports on the transaction. They agree."
                : memoMatches === false
                  ? "These should be identical. A mismatch means the transaction on chain is not the one this page thinks it built."
                  : "The right-hand value is fetched separately from Horizon, so this comparison means something. Until it loads there is nothing to compare against."}
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Transaction" />
            <div className="divide-y divide-outline-variant">
              <div className="px-space-base py-space-sm flex flex-wrap items-center gap-space-sm">
                <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline w-32 shrink-0">
                  transaction
                </span>
                <HashChip
                  value={result.transactionHash}
                  href={stellarExpertTxUrl(result.transactionHash)}
                  label="transaction hash"
                />
              </div>
              <div className="px-space-base py-space-sm flex flex-wrap items-center gap-space-sm">
                <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline w-32 shrink-0">
                  ephemeral signer
                </span>
                <HashChip
                  value={result.ephemeralPublicKey}
                  href={stellarExpertAccountUrl(result.ephemeralPublicKey)}
                  label="ephemeral signer"
                />
              </div>
              <table className="w-full font-code-compact text-code-compact">
                <tbody className="divide-y divide-outline-variant">
                  <tr>
                    <td className="px-space-base py-space-xs text-on-surface">acuris</td>
                    <td className="px-space-base py-space-xs text-right text-primary">
                      {formatMinorAsDecimal(result.split.legs[0].amountMinor)} XLM
                    </td>
                  </tr>
                  <tr>
                    <td className="px-space-base py-space-xs text-on-surface">partner</td>
                    <td className="px-space-base py-space-xs text-right text-primary">
                      {formatMinorAsDecimal(result.split.legs[1].amountMinor)} XLM
                    </td>
                  </tr>
                  <tr className="bg-surface-container-low">
                    <td className="px-space-base py-space-xs text-primary font-medium">
                      Gross total
                    </td>
                    <td className="px-space-base py-space-xs text-right text-primary font-medium">
                      {formatMinorAsDecimal(result.split.grossMinor)} XLM
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <CodeBlock
            title="Verify it yourself"
            code={horizonVerifyCommand(result.transactionHash)}
            caption="Queries Horizon directly and prints the memo. Compare it to the digest above — there is no D1 verification script yet, so this is the honest path."
          />

          {event ? (
            <Disclosure summary="Raw revenue event (JSON)" aside="the digest's input">
              <pre className="font-code-compact text-code-compact text-on-surface overflow-x-auto select-all">
                {JSON.stringify(event, null, 2)}
              </pre>
              <p className="mt-space-sm pt-space-xs border-t border-outline-variant font-code-micro text-code-micro text-outline">
                Rederive the digest yourself with packages/canonical — field order and formats are
                pinned in docs/canonicalization.md.
              </p>
            </Disclosure>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setResult(undefined);
              setConfirmation(undefined);
            }}
            className="self-start font-code-compact text-code-compact text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            [ run another settlement ]
          </button>
        </>
      ) : null}

      <FailureCasePanel
        title="Failure cases"
        framing={
          <>
            The first two are refused by the split engine and transaction builder before anything is
            sent. The last three submit a real, signed transaction to Testnet and let the network
            reject it. Cases below the divider are scoped for the funded sprint and are not built —
            listed so nothing here overstates what this deployment can do.
          </>
        }
        liveCases={liveCases}
        pendingCases={PENDING_CASES}
        onRun={(id) => void runCase(id)}
      />

      {runningCase ? (
        <p className="flex items-center gap-space-xs font-code-micro text-code-micro text-outline">
          <SpinnerIcon size={11} />
          Network cases fund a throwaway probe account on first run — this takes a few seconds.
        </p>
      ) : null}
    </>
  );
}
