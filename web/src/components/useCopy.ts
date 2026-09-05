import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard with a short confirmation state. Every hash on this page is meant to be
 * carried somewhere else and checked, so the copy affordance is load-bearing rather than a nicety.
 */
export function useCopy(resetAfterMs = 1200): {
  copied: boolean;
  copy: (value: string) => void;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    (value: string) => {
      void navigator.clipboard
        .writeText(value)
        .then(() => {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), resetAfterMs);
        })
        .catch(() => {
          // Clipboard access can be denied outright (insecure context, permissions policy).
          // The value is always selectable on the page, so silence is the right fallback.
        });
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
