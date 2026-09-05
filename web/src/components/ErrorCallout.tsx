import type { ReactNode } from "react";
import { ArchiveIcon, ErrorIcon, OfflineIcon, WarningIcon } from "./icons.js";

export type CalloutTone = "error" | "warning" | "info";

const TONE = {
  error: { edge: "border-l-error", text: "text-error" },
  warning: { edge: "border-l-warning", text: "text-warning" },
  info: { edge: "border-l-outline", text: "text-on-surface-variant" },
} as const;

/**
 * The single shape every "something upstream is wrong" state uses. One component, three tones —
 * so a visitor learns once that this treatment means an environment condition, not a broken page.
 *
 * Every instance states what failed *and* what to do about it; a callout with no action is a dead
 * end, and this console has enough real failure modes that dead ends would be common.
 */
export function ErrorCallout({
  tone,
  title,
  children,
  diagnostic,
  actions,
  icon,
}: {
  tone: CalloutTone;
  title: string;
  children: ReactNode;
  /** The raw error string from the network or contract, shown verbatim. */
  diagnostic?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  const { edge, text } = TONE[tone];

  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant border-l-4 ${edge} rounded-sm p-space-base flex flex-col gap-space-sm`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-space-sm">
        <span className={`${text} mt-0.5 shrink-0`}>
          {icon ?? (tone === "error" ? <ErrorIcon size={16} /> : <WarningIcon size={16} />)}
        </span>
        <div className="flex flex-col gap-space-xs min-w-0">
          <h3 className="font-title-sm text-title-sm text-primary">{title}</h3>
          <p className="font-body-compact text-body-compact text-on-surface-variant">{children}</p>
        </div>
      </div>

      {diagnostic ? (
        <pre className="bg-surface-dim border border-outline-variant rounded-sm px-space-sm py-space-xs font-code-compact text-code-compact text-on-surface-variant overflow-x-auto whitespace-pre-wrap break-words">
          {diagnostic}
        </pre>
      ) : null}

      {actions ? (
        <div className="flex flex-wrap items-center gap-space-sm pt-space-xs border-t border-outline-variant">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** A secondary action for use inside a callout's action row. */
export function CalloutAction({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded-sm border border-outline-variant bg-surface-container-lowest text-on-surface font-body-compact text-body-compact hover:border-outline hover:text-primary transition-colors cursor-pointer";

  if (href) {
    return (
      <a className={className} href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

export { ArchiveIcon, OfflineIcon };
