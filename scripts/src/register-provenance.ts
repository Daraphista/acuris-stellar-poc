/**
 * D2 demonstration: hash a (synthetic) batch manifest and register it on the deployed
 * provenance contract. See docs/architecture.md for the full flow and docs/runbook.md for
 * prerequisites (funded `registrar` identity, PROVENANCE_CONTRACT_ID set).
 *
 * Usage: npm run provenance:register [-- <manifestPath> <batchIdLabel> <termsRefLabel> [supersedesHex]]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { batchHash, toHex, type BatchManifestEntry } from "@acuris-stellar-poc/canonical";
import {
  CONTRACT_ERROR_NAMES,
  hexEncode,
  invoke,
  parseContractErrorCode,
  requiredEnv,
} from "./stellar-cli.js";

interface ManifestFile {
  synthetic: boolean;
  entries: BatchManifestEntry[];
}

function defaultManifestPath(): string {
  return fileURLToPath(
    new URL("../../fixtures/batch-manifests/batch_0001.synthetic.json", import.meta.url),
  );
}

const manifestPath = process.argv[2] ?? defaultManifestPath();
const batchIdLabel = process.argv[3] ?? "batch-0001-synthetic";
const termsRefLabel = process.argv[4] ?? "acuris-ekonsulta-terms-v1-synthetic";
const supersedesHex = process.argv[5];

const manifest: ManifestFile = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.synthetic !== true && process.env.ACKNOWLEDGE_REAL_DATA !== "1") {
  throw new Error(
    `refusing to proceed: ${manifestPath} is not marked "synthetic": true. ` +
      `If this is deliberate, set ACKNOWLEDGE_REAL_DATA=1. See docs/privacy-model.md.`,
  );
}

const hash = toHex(batchHash(manifest.entries));
const batchIdHex = hexEncode(batchIdLabel);
const termsRefHex = hexEncode(termsRefLabel);

const contractId = requiredEnv("PROVENANCE_CONTRACT_ID");
const registrarPublicKey = requiredEnv("REGISTRAR_PUBLIC_KEY");
const registrarIdentity = process.env.STELLAR_REGISTRAR_IDENTITY ?? "registrar";

console.log(`manifest:   ${manifestPath}`);
console.log(`batch_id:   "${batchIdLabel}" (hex ${batchIdHex})`);
console.log(`terms_ref:  "${termsRefLabel}" (hex ${termsRefHex})`);
console.log(`batch_hash: ${hash}`);
console.log(`contract:   ${contractId}`);
console.log(`registrar:  ${registrarPublicKey} (identity "${registrarIdentity}")`);
console.log();

const invokeArgs = [
  "register",
  "--registrar",
  registrarPublicKey,
  "--batch_id",
  batchIdHex,
  "--batch_hash",
  hash,
  "--terms_ref",
  termsRefHex,
];
if (supersedesHex) {
  // The CLI's raw-hex shorthand ("the only types which aren't JSON are Bytes and BytesN")
  // applies to a bare BytesN<32> argument, but `supersedes` is Option<BytesN<32>> — the CLI's
  // generic arg parser needs that as a JSON string, not bare hex. Confirmed empirically: a bare
  // hex value here fails argument parsing before any simulation, so it never reaches the chain.
  invokeArgs.push("--supersedes", JSON.stringify(supersedesHex));
}

const result = invoke({ contractId, sourceIdentity: registrarIdentity, args: invokeArgs });

if (result.status === 0) {
  console.log(result.stdout.trim() || "(no return value — write call)");
  // The CLI prints the signed tx hash and explorer link to stderr even on success — surface it,
  // it's the evidence a reviewer actually wants (see docs/evidence.md).
  const txLines = result.stderr
    .split("\n")
    .filter((l) => l.includes("Signing transaction") || l.includes("stellar.expert"));
  if (txLines.length > 0) {
    console.log(txLines.join("\n"));
  }
  console.log(
    "\nRegistered. Run 'npm run provenance:verify' to independently confirm the on-chain record matches this manifest.",
  );
  process.exit(0);
}

const code = parseContractErrorCode(result.stderr);
if (code === 5) {
  console.log("Already registered on this contract (DuplicateRecord) — this batch_hash exists on-chain already.");
  console.log("Run 'npm run provenance:verify' to confirm the existing record matches this manifest.");
  process.exit(0);
}

console.error(result.stderr);
if (code !== undefined) {
  console.error(`\nContract rejected the call: ${CONTRACT_ERROR_NAMES[code] ?? `error #${code}`}`);
}
process.exit(1);
