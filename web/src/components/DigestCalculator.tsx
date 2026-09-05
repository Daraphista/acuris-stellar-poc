import { useEffect, useState } from "react";
import { batchHashAsync, toHex, CanonicalError, type BatchManifestEntry } from "@acuris-stellar-poc/canonical/browser";
import batch0001CorrectedV2 from "@fixtures/batch-manifests/batch_0001_corrected_v2.synthetic.json";
import { HashChip } from "./HashChip.js";
import { CancelIcon, CheckCircleIcon, ErrorIcon } from "./icons.js";

// The manifest that get_by_batch_id("batch-0001-synthetic") currently resolves to — the newest
// link in the demo's supersession chain — so this calculator shows MATCH against a freshly
// looked-up record without the visitor having to paste anything first. Imported directly from
// fixtures/, not hand-copied, so it can never silently drift from the file the rest of the repo
// (docs/evidence.md, both test suites) treats as the source of truth.
const DEFAULT_MANIFEST_TEXT = JSON.stringify(batch0001CorrectedV2, null, 2);

function extractEntries(parsed: unknown): BatchManifestEntry[] {
  const candidate = Array.isArray(parsed) ? parsed : (parsed as { entries?: unknown })?.entries;
  if (!Array.isArray(candidate)) {
    throw new CanonicalError("expected a JSON array of entries, or an object with an \"entries\" array");
  }
  return candidate.map((e, i) => {
    if (typeof e !== "object" || e === null || typeof (e as BatchManifestEntry).relativePath !== "string" || typeof (e as BatchManifestEntry).sha256Hex !== "string") {
      throw new CanonicalError(`entry ${i} must be {"relativePath": string, "sha256Hex": string}`);
    }
    return { relativePath: (e as BatchManifestEntry).relativePath, sha256Hex: (e as BatchManifestEntry).sha256Hex };
  });
}

export function DigestCalculator({ compareToHex }: { compareToHex?: string }) {
  const [text, setText] = useState(DEFAULT_MANIFEST_TEXT);
  const [computedHex, setComputedHex] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = extractEntries(JSON.parse(text));
        const hash = await batchHashAsync(entries);
        if (!cancelled) {
          setComputedHex(toHex(hash));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setComputedHex(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text]);

  const isMatch = computedHex !== null && compareToHex !== undefined && computedHex === compareToHex;
  const isMismatch = computedHex !== null && compareToHex !== undefined && computedHex !== compareToHex;

  return (
    <div className="flex flex-col gap-space-sm">
      <p className="font-body-compact text-body-compact text-on-surface-variant">
        The digest is recomputed in your browser as you type, using the same encoding rules as the
        Rust contract. Nothing is sent anywhere — edit a byte and watch the match break.
      </p>

      <div className="flex flex-col gap-space-xs">
        <label
          className="font-code-micro text-code-micro uppercase tracking-wider text-outline"
          htmlFor="manifest-json"
        >
          Manifest entries (JSON)
        </label>
        <textarea
          id="manifest-json"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={12}
          className={`w-full bg-surface-dim border rounded-sm p-space-sm font-code-compact text-code-compact text-on-surface resize-y focus:outline-none focus:border-primary ${
            error ? "border-error" : "border-outline-variant"
          }`}
        />
      </div>

      {error ? (
        <div className="flex items-start gap-space-xs px-space-sm py-space-xs rounded-sm border border-error/40 bg-error/10">
          <ErrorIcon size={14} className="text-error mt-0.5 shrink-0" />
          <span className="font-code-compact text-code-compact text-error break-words">{error}</span>
        </div>
      ) : null}

      {computedHex ? (
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="font-code-micro text-code-micro uppercase tracking-wider text-outline">
            computed batch_hash
          </span>
          <HashChip value={computedHex} label="computed batch_hash" />
        </div>
      ) : null}

      {isMatch ? (
        <div className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-sm border border-secondary/40 bg-secondary/10">
          <CheckCircleIcon size={14} className="text-secondary shrink-0" />
          <span className="font-code-compact text-code-compact text-secondary">
            MATCH — equals the batch_hash recorded on chain
          </span>
        </div>
      ) : null}

      {isMismatch ? (
        <div className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-sm border border-error/40 bg-error/10">
          <CancelIcon size={14} className="text-error shrink-0" />
          <span className="font-code-compact text-code-compact text-error">
            NO MATCH — differs from the batch_hash recorded on chain
          </span>
        </div>
      ) : null}

      {!compareToHex && computedHex ? (
        <p className="font-code-micro text-code-micro text-outline">
          Look up a record above to compare this against what the contract holds.
        </p>
      ) : null}
    </div>
  );
}
