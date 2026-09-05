import type { ReactNode } from "react";
import { CheckIcon, SpinnerIcon } from "./icons.js";

export type StepState = "pending" | "active" | "done" | "failed";

export interface Step {
  id: string;
  label: string;
  state: StepState;
  /** What this step actually produced — an event id, a public key, two amounts. Shown only once
   *  the step is done, because a value that isn't computed yet is not a value. */
  detail?: ReactNode;
  /** Live sub-line for an active step, e.g. a retry count. Surfacing the retry is deliberate:
   *  a silent four-attempt wait looks identical to a hang. */
  note?: ReactNode;
}

function Node({ state }: { state: StepState }) {
  const base =
    "w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center bg-surface-container-lowest border";

  if (state === "done") {
    return (
      <span className={`${base} border-secondary text-secondary`}>
        <CheckIcon size={13} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className={`${base} border-primary text-primary`}>
        <SpinnerIcon size={13} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className={`${base} border-error text-error`}>
        <span className="font-code-micro text-code-micro leading-none">✕</span>
      </span>
    );
  }
  return (
    <span className={`${base} border-outline-variant`}>
      <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
    </span>
  );
}

/**
 * The settlement run, shown as the sequence it actually is. Each row is one real operation, and
 * each completed row shows what that operation produced — so a visitor watching a demo can see
 * the keypair, the digest and the split appear rather than a spinner and then an answer.
 */
export function StepRail({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((step) => step.state === "done").length;

  return (
    <div className="p-space-base">
      <div className="flex items-center justify-between pb-space-xs mb-space-base border-b border-outline-variant">
        <span className="font-label-default text-label-default uppercase tracking-wider text-on-surface-variant">
          Execution
        </span>
        <span className="font-code-micro text-code-micro text-outline">
          step {Math.min(doneCount + 1, steps.length)} of {steps.length}
        </span>
      </div>

      <ol className="relative flex flex-col">
        <span
          className="absolute left-[11px] top-3 bottom-5 w-px bg-outline-variant"
          aria-hidden
        />
        {steps.map((step, index) => {
          const dim =
            step.state === "pending" ? (index > doneCount + 1 ? "opacity-40" : "opacity-60") : "";
          return (
            <li
              key={step.id}
              className={`relative flex items-start gap-space-base ${
                index === steps.length - 1 ? "" : "pb-space-lg"
              } ${dim}`}
            >
              <Node state={step.state} />
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline justify-between gap-space-sm">
                  <span
                    className={`font-title-sm text-title-sm ${
                      step.state === "active" ? "text-primary font-semibold" : "text-on-surface"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.state === "pending" ? (
                    <span className="font-code-micro text-code-micro text-outline shrink-0">
                      queued
                    </span>
                  ) : null}
                </div>

                {step.detail ? (
                  <div className="mt-space-xs font-code-compact text-code-compact text-on-surface-variant break-all">
                    {step.detail}
                  </div>
                ) : null}

                {step.note && step.state === "active" ? (
                  <div className="mt-space-xs bg-surface-container border border-outline-variant rounded-sm px-space-sm py-space-xs font-code-micro text-code-micro text-on-surface-variant">
                    {step.note}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
