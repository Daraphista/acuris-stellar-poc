import { useEffect, useState } from "react";
import { batchHashAsync, toHex, CanonicalError, type BatchManifestEntry } from "@acuris-stellar-poc/canonical/browser";
import batch0001CorrectedV2 from "@fixtures/batch-manifests/batch_0001_corrected_v2.synthetic.json";
import { HashDisplay } from "./HashDisplay.js";
import { Callout } from "./Callout.js";

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
    <div>
      <p className="hint">
        Paste manifest entries (or edit the pre-filled ones below) — the digest is recomputed in
        this browser, from the same encoding rules as the Rust contract, every time you type.
      </p>
      <div className="field">
        <label htmlFor="manifest-json">Manifest entries (JSON)</label>
        <textarea
          id="manifest-json"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {error && <Callout kind="error">{error}</Callout>}
      {computedHex && <HashDisplay label="computed batch_hash" value={computedHex} />}

      {isMatch && <div className="match-banner match">✓ MATCH — equals the on-chain batch_hash above</div>}
      {isMismatch && <div className="match-banner no-match">✗ NO MATCH — differs from the on-chain batch_hash above</div>}
    </div>
  );
}
