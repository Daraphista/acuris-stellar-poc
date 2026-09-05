import type { ReactNode } from "react";

/**
 * The one container in this system. Flat surface, hairline border, no shadow — depth comes from
 * tonal steps and 1px rules, never from blur.
 */
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface-container-lowest border border-outline-variant rounded-sm ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

/** A panel's title strip. `aside` carries the one piece of context that belongs at this level —
 *  a count, a status, a network — and nothing decorative. */
export function PanelHeader({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-space-sm px-space-base py-space-sm border-b border-outline-variant">
      <h2 className="font-label-default text-label-default uppercase tracking-wider text-on-surface-variant">
        {title}
      </h2>
      {aside ? <div className="flex items-center gap-space-xs shrink-0">{aside}</div> : null}
    </header>
  );
}

/**
 * A label/value line. Labels are prose-cased and quiet; values carry the weight. `mono` is the
 * default because most of what this console shows is a machine value.
 */
export function DataRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-space-xs md:gap-space-sm px-space-base py-space-sm items-baseline hover:bg-surface-container-low transition-colors">
      <div className="md:col-span-3 font-code-micro text-code-micro text-outline uppercase tracking-wider">
        {label}
      </div>
      <div className="md:col-span-9 flex flex-wrap items-center gap-space-xs font-code-compact text-code-compact text-primary">
        {children}
        {hint ? <span className="text-outline font-code-micro text-code-micro">{hint}</span> : null}
      </div>
    </div>
  );
}

/** Vertically stacked `DataRow`s with hairlines between them. */
export function DataList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-outline-variant">{children}</div>;
}
