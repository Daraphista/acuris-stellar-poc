import { useState } from "react";

export function HashDisplay({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  /** If given, wraps the value in a link (e.g. to stellar.expert) instead of plain text. */
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions) — not worth surfacing
      // as an error for a convenience feature; the value is still selectable text.
    }
  }

  return (
    <div className="hash-row">
      <span className="label">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
      <button type="button" className="copy-button" onClick={copy}>
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
