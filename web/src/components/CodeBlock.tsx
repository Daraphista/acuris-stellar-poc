import type { ReactNode } from "react";
import { useCopy } from "./useCopy.js";

/**
 * A command or payload the visitor is meant to take away and run. The copy button is the whole
 * point — "verify this yourself" is not a real offer if the command has to be retyped.
 */
export function CodeBlock({
  title,
  code,
  caption,
  aside,
}: {
  title: string;
  code: string;
  caption?: ReactNode;
  aside?: ReactNode;
}) {
  const { copied, copy } = useCopy();

  return (
    <div className="border border-outline-variant bg-surface-container-lowest rounded-sm p-space-sm flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-space-sm">
        <span className="font-code-compact text-code-compact text-primary font-medium">{title}</span>
        <div className="flex items-center gap-space-xs shrink-0">
          {aside}
          <button
            type="button"
            onClick={() => copy(code)}
            className="font-code-micro text-code-micro text-outline hover:text-primary border border-outline-variant hover:border-outline px-2 py-0.5 rounded-sm bg-surface-container-lowest transition-colors cursor-pointer"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <pre className="bg-surface-dim border border-outline-variant rounded-sm p-space-sm overflow-x-auto">
        <code className="font-code-compact text-code-compact text-on-surface select-all whitespace-pre">
          {code}
        </code>
      </pre>

      {caption ? (
        <p className="font-code-micro text-code-micro text-outline">{caption}</p>
      ) : null}
    </div>
  );
}
