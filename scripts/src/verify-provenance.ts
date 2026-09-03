/**
 * D2 independent verification: recompute a batch's digest locally from the (synthetic)
 * manifest, fetch the on-chain record by that digest, and confirm they agree. This is the
 * reviewable claim in docs/evidence.md — it does not trust any cached or previously-printed
 * value, only what the contract returns right now and what this manifest hashes to right now.
 *
 * Usage: npm run provenance:verify [-- <manifestPath>]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { batchHash, toHex, type BatchManifestEntry } from "@acuris-stellar-poc/canonical";
import { CONTRACT_ERROR_NAMES, invoke, parseContractErrorCode, requiredEnv } from "./stellar-cli.js";

interface ManifestFile {
  synthetic: boolean;
  entries: BatchManifestEntry[];
}

interface OnChainRecord {
  batch_hash: string;
  batch_id: string;
  terms_ref: string;
  registered_at: number;
  registrar: string;
  supersedes: string | null;
  status: "Active" | "Superseded" | "Revoked";
}

function defaultManifestPath(): string {
  return fileURLToPath(
    new URL("../../fixtures/batch-manifests/batch_0001.synthetic.json", import.meta.url),
  );
}

const manifestPath = process.argv[2] ?? defaultManifestPath();
const manifest: ManifestFile = JSON.parse(readFileSync(manifestPath, "utf8"));

const recomputedHash = toHex(batchHash(manifest.entries));

const contractId = requiredEnv("PROVENANCE_CONTRACT_ID");
// Reads are unauthenticated on-chain, but the CLI still needs a funded source account to
// simulate against — any identity works here, it never signs anything for a read-only call.
const readerIdentity = process.env.STELLAR_REGISTRAR_IDENTITY ?? "registrar";

console.log(`manifest:         ${manifestPath}`);
console.log(`recomputed hash:  ${recomputedHash}`);
console.log(`contract:         ${contractId}`);
console.log();

const result = invoke({
  contractId,
  sourceIdentity: readerIdentity,
  args: ["get", "--batch_hash", recomputedHash],
});

if (result.status !== 0) {
  const code = parseContractErrorCode(result.stderr);
  console.error(result.stderr);
  if (code !== undefined) {
    console.error(`\nContract call failed: ${CONTRACT_ERROR_NAMES[code] ?? `error #${code}`}`);
  }
  console.error(
    "\nFAIL: no on-chain record for this manifest's digest. Run 'npm run provenance:register' first.",
  );
  process.exit(1);
}

const record: OnChainRecord = JSON.parse(result.stdout.trim());
console.log("on-chain record:", JSON.stringify(record, null, 2));

const matches = record.batch_hash === recomputedHash;
console.log();
if (matches) {
  console.log(
    `PASS: the on-chain batch_hash matches the digest independently recomputed from ${manifestPath}.`,
  );
  console.log(`      status: ${record.status}  registered_at: ${record.registered_at} (ledger time)`);
  process.exit(0);
} else {
  console.error(
    `FAIL: on-chain batch_hash (${record.batch_hash}) does not match the recomputed digest (${recomputedHash}).`,
  );
  process.exit(1);
}
