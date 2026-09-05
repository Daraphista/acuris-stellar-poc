/**
 * The console's whole icon set, inline. The mockups used the Material Symbols webfont; a few
 * hundred KB of font for a dozen glyphs is not a trade worth making on a page whose point is to
 * load fast and work offline-ish during a demo.
 *
 * Every icon inherits `currentColor` and sizes from the `size` prop (default 14px, matching the
 * `code-compact` line box they usually sit in).
 */

interface IconProps {
  size?: number;
  className?: string;
}

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    focusable: false,
  };
}

export function CopyIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L16 9.5" />
    </svg>
  );
}

export function CancelIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

export function ErrorIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

export function WarningIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function InfoIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4.5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

export function PlayIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M6 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  );
}

export function SearchIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ArchiveIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function OfflineIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="m2 2 20 20" />
      <path d="M5 12.5a11 11 0 0 1 4-2.3" />
      <path d="M1.5 8.8a16 16 0 0 1 5-3.2" />
      <path d="M14.7 10.4a11 11 0 0 1 4.3 2.1" />
      <path d="M10.6 5.4a16 16 0 0 1 11.9 3.4" />
      <path d="M8.5 16a6 6 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </svg>
  );
}

/** The one animated element in the system. Respects reduced-motion via the global rule. */
export function SpinnerIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} className={`animate-spin ${className ?? ""}`}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
