import { CheckIcon, CopyIcon, ExternalLinkIcon } from "./icons.js";
import { useCopy } from "./useCopy.js";

/** Front-and-tail truncation, so a value stays recognisable at a glance without eating the row.
 *  The full value is always what gets copied and what sits in the DOM's title attribute. */
export function truncateHash(value: string, lead = 8, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

interface HashChipProps {
  value: string;
  /** Show the whole value rather than truncating — for the one or two places where the full
   *  string is the point, like the contract address on the index. */
  full?: boolean;
  href?: string;
  /** Screen-reader/hover description of what is being copied. */
  label?: string;
  className?: string;
}

/**
 * A machine value with its two affordances: open it on an explorer, or copy it. Both matter —
 * a reviewer either checks it somewhere else, or pastes it into their own tooling.
 */
export function HashChip({ value, full = false, href, label, className }: HashChipProps) {
  const { copied, copy } = useCopy();
  const shown = full ? value : truncateHash(value);

  return (
    <span className={`inline-flex items-center gap-space-xs ${className ?? ""}`}>
      {href ? (
        <a
          className="font-code-compact text-code-compact text-on-surface hover:text-primary hover:underline inline-flex items-center gap-1 break-all"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
          title={value}
        >
          <span>{shown}</span>
          <ExternalLinkIcon size={12} className="text-outline shrink-0" />
        </a>
      ) : (
        <span
          className="font-code-compact text-code-compact text-on-surface break-all select-all"
          title={value}
        >
          {shown}
        </span>
      )}

      <button
        type="button"
        onClick={() => copy(value)}
        title={label ? `Copy ${label}` : "Copy full value"}
        aria-label={label ? `Copy ${label}` : "Copy full value"}
        className="shrink-0 inline-flex items-center gap-1 px-1 py-0.5 rounded-sm border border-outline-variant bg-surface-container-lowest text-outline hover:text-primary hover:border-outline transition-colors cursor-pointer"
      >
        {copied ? <CheckIcon size={12} className="text-secondary" /> : <CopyIcon size={12} />}
        <span className="font-code-micro text-code-micro">{copied ? "copied" : "copy"}</span>
      </button>
    </span>
  );
}
