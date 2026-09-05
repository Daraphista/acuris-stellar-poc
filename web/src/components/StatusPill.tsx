export type StatusTone = "verified" | "warning" | "error" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  // Mint means "checked and it agrees" — never used decoratively.
  verified: "text-secondary border-secondary/40 bg-secondary/10",
  warning: "text-warning border-warning/40 bg-warning/10",
  error: "text-error border-error/40 bg-error/10",
  neutral: "text-on-surface-variant border-outline-variant bg-surface-container",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  verified: "bg-secondary",
  warning: "bg-warning",
  error: "bg-error",
  neutral: "bg-outline-variant",
};

/** Maps a record's on-chain status to a tone. `Superseded` is deliberately not an error: being
 *  superseded is the correction model working, not something going wrong. */
export function toneForRecordStatus(status: string): StatusTone {
  if (status === "Active") return "verified";
  if (status === "Superseded") return "warning";
  if (status === "Revoked") return "error";
  return "neutral";
}

export function StatusPill({
  children,
  tone = "neutral",
  dot = true,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border font-code-micro text-code-micro uppercase tracking-wider font-medium ${TONE_CLASSES[tone]}`}
    >
      {dot ? (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASSES[tone]}`} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
