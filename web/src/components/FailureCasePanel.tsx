import type { ReactNode } from "react";
import { Panel, PanelHeader } from "./Panel.js";
import { SpinnerIcon } from "./icons.js";

export interface LiveFailureCase {
  id: string;
  name: string;
  /** What the case attempts, in one line. */
  description: string;
  state: "idle" | "running" | "done";
  result?: {
    code: string;
    /** Which layer said no — the distinction between "we refused to build it" and "the network
     *  refused it" is most of the value of showing these at all. */
    source: string;
    detail: string;
    /** False when the guard did not fire. Rendered as a problem, never as a pass. */
    rejected: boolean;
  };
}

export interface PendingFailureCase {
  id: string;
  name: string;
  /** Why it cannot run yet, and which sprint week lands it. */
  note: string;
}

function LiveRow({ testCase, onRun }: { testCase: LiveFailureCase; onRun: (id: string) => void }) {
  const { result } = testCase;

  return (
    <div className="grid grid-cols-12 gap-space-sm items-start px-space-base py-space-sm hover:bg-surface-container-low transition-colors">
      <div className="col-span-12 sm:col-span-4 flex items-start gap-space-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="font-title-sm text-title-sm text-primary">{testCase.name}</div>
          <p className="font-body-compact text-body-compact text-on-surface-variant mt-0.5">
            {testCase.description}
          </p>
        </div>
      </div>

      <div className="col-span-4 sm:col-span-2 flex sm:justify-center">
        <button
          type="button"
          disabled={testCase.state === "running"}
          onClick={() => onRun(testCase.id)}
          className="inline-flex items-center gap-space-xs px-2 py-0.5 rounded-sm border border-outline-variant bg-surface-container-lowest text-primary font-code-micro text-code-micro hover:border-outline transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testCase.state === "running" ? (
            <>
              <SpinnerIcon size={11} />
              <span>running</span>
            </>
          ) : (
            <span>[ run ]</span>
          )}
        </button>
      </div>

      <div className="col-span-8 sm:col-span-6 min-w-0">
        {result ? (
          <div className="flex flex-col gap-space-xxs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span
                className={`px-1.5 py-0.5 rounded-sm border font-code-micro text-code-micro font-medium ${
                  result.rejected
                    ? "text-error border-error/40 bg-error/10"
                    : "text-warning border-warning/40 bg-warning/10"
                }`}
              >
                {result.code}
              </span>
              <span className="px-1 py-0.5 rounded-sm border border-outline-variant bg-surface-container font-code-micro text-code-micro text-outline">
                {result.source}
              </span>
              {!result.rejected ? (
                <span className="font-code-micro text-code-micro text-warning">
                  guard did not fire
                </span>
              ) : null}
            </div>
            <p className="font-code-compact text-code-compact text-on-surface-variant break-words">
              {result.detail}
            </p>
          </div>
        ) : (
          <span className="font-code-micro text-code-micro text-outline">not run yet</span>
        )}
      </div>
    </div>
  );
}

/**
 * Failure cases, split into what runs for real and what is honestly not built yet.
 *
 * The divider is the point. A reviewer reading this should be able to tell, without asking, which
 * assertions this deployment can actually make — overstating coverage is the fastest way to lose
 * a technical reader, and the pending rows cost nothing to be straight about.
 */
export function FailureCasePanel({
  title,
  framing,
  liveCases,
  pendingCases,
  onRun,
}: {
  title: string;
  framing: ReactNode;
  liveCases: LiveFailureCase[];
  pendingCases?: PendingFailureCase[];
  onRun: (id: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title={title}
        aside={
          <span className="font-code-micro text-code-micro text-outline">
            {liveCases.length} runnable
            {pendingCases?.length ? ` · ${pendingCases.length} pending` : ""}
          </span>
        }
      />

      <p className="px-space-base py-space-sm border-b border-outline-variant font-body-compact text-body-compact text-on-surface-variant">
        {framing}
      </p>

      <div className="divide-y divide-outline-variant">
        {liveCases.map((testCase) => (
          <LiveRow key={testCase.id} testCase={testCase} onRun={onRun} />
        ))}
      </div>

      {pendingCases?.length ? (
        <>
          <div className="px-space-base py-space-xs bg-surface-container-low border-y border-outline-variant">
            <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline">
              Not built yet — funded 30-day sprint scope
            </span>
          </div>
          <div className="divide-y divide-outline-variant/40 opacity-70">
            {pendingCases.map((testCase) => (
              <div
                key={testCase.id}
                className="grid grid-cols-12 gap-space-sm items-baseline px-space-base py-space-sm"
              >
                <div className="col-span-12 sm:col-span-4 flex items-center gap-space-xs">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-outline-variant shrink-0"
                    aria-hidden
                  />
                  <span className="font-body-default text-body-default text-on-surface-variant">
                    {testCase.name}
                  </span>
                </div>
                <div className="col-span-4 sm:col-span-2 sm:text-center">
                  <span className="font-code-micro text-code-micro text-outline-variant select-none">
                    [ staged ]
                  </span>
                </div>
                <div className="col-span-8 sm:col-span-6">
                  <span className="font-code-compact text-code-compact text-outline italic">
                    {testCase.note}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Panel>
  );
}
