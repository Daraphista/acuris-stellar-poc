import type { ReactNode } from "react";
import { ChevronRightIcon } from "./icons.js";

/** Native `<details>`, so it works without JavaScript state and keyboard support comes free. */
export function Disclosure({
  summary,
  aside,
  children,
  defaultOpen = false,
}: {
  summary: string;
  aside?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border border-outline-variant bg-surface-container-lowest rounded-sm" open={defaultOpen}>
      <summary className="flex items-center justify-between gap-space-sm px-space-sm py-space-xs cursor-pointer select-none border-b border-outline-variant text-on-surface hover:text-primary transition-colors">
        <span className="flex items-center gap-1.5 font-code-compact text-code-compact">
          <ChevronRightIcon
            size={14}
            className="text-outline transition-transform group-open:rotate-90"
          />
          {summary}
        </span>
        {aside ? (
          <span className="font-code-micro text-code-micro text-outline shrink-0">{aside}</span>
        ) : null}
      </summary>
      <div className="p-space-sm">{children}</div>
    </details>
  );
}
