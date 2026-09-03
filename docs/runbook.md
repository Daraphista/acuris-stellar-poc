# Runbook

Exact commands, verified by actually running them against Stellar Testnet during this project's
Phase 0 (see `docs/devlog.md`). Versions below are what was actually used, not aspirational pins.

## Toolchain

| Tool | Version used | Install |
|---|---|---|
| Rust | 1.98.0 (stable) | `brew install rustup-init` (installs the keg-only `rustup` formula), then `rustup toolchain install stable` — or just build once; `rust-toolchain.toml` at the repo root auto-installs it |
| wasm target | `wasm32v1-none` | `rustup target add wasm32v1-none` |
| `stellar` CLI | 28.0.0 | `brew install stellar-cli` (from homebrew-core, **not** the `stellar/tap` formula, which only ships the legacy `soroban-cli`) |
| `soroban-sdk` (Rust crate) | 27.0.6 | pinned in `contracts/provenance/Cargo.toml` |
| Node.js | 22.x (`.nvmrc`) | `nvm install` from the repo root |
| npm | ships with Node | — |

If `rustup`/`cargo`/`rustc` aren't on `PATH` after a Homebrew install (it's keg-only):
```
export PATH="$HOME/.cargo/bin:/opt/homebrew/opt/rustup/bin:$PATH"
```

## Install & test (no network required beyond npm/crates registries)

```
nvm use
npm install
npm run build && npm test          # TypeScript: packages/canonical (includes vector parity)
cargo test -p acuris-provenance-contract   # Rust: contract unit tests + vector parity
```

Both test suites must pass before anything below touches the network — they're what verify the
canonicalization spec is actually implemented correctly (`docs/canonicalization.md`).

## Testnet accounts

Four identities: `admin` (contract owner), `registrar` (allow-listed to call `register`), and
`acuris` / `partner` (D1, funded sprint scope — created now for convenience).

```
for name in admin registrar acuris partner; do
  stellar keys generate "$name" --network testnet --fund
done
stellar keys address admin       # copy into .env as ADMIN_PUBLIC_KEY, etc.
```

Keys live in `~/.config/stellar/identity/` — outside this repo, never committed. Copy `.env.example`
to `.env` (gitignored) and fill in the four `*_PUBLIC_KEY` values from `stellar keys address <name>`.

## Build & deploy the contract

```
stellar contract build
# -> target/wasm32v1-none/release/acuris_provenance_contract.wasm
#    prints the WASM hash and exported functions; record both in docs/evidence.md

stellar contract deploy \
  --wasm target/wasm32v1-none/release/acuris_provenance_contract.wasm \
  --source admin --network testnet -- 
# -> prints two tx hashes (wasm upload, contract creation) and the contract id (C...)
# record the contract id as PROVENANCE_CONTRACT_ID in .env
```

## Initialize

```
stellar contract invoke --id "$PROVENANCE_CONTRACT_ID" --source admin --network testnet -- \
  init --admin "$(stellar keys address admin)"

stellar contract invoke --id "$PROVENANCE_CONTRACT_ID" --source admin --network testnet -- \
  set_registrar --admin "$(stellar keys address admin)" \
  --registrar "$(stellar keys address registrar)" --allowed true
```

## Register and independently verify a provenance record

```
cd scripts
npm run build
node --env-file=../.env dist/register-provenance.js
node --env-file=../.env dist/verify-provenance.js
```

By default these use `fixtures/batch-manifests/batch_0001.synthetic.json`. To register a
different (still-synthetic) manifest, or to demonstrate a correction:

```
node --env-file=../.env dist/register-provenance.js <manifestPath> <batchIdLabel> <termsRefLabel> [supersedesHex]
node --env-file=../.env dist/verify-provenance.js <manifestPath>
```

`register-provenance.ts` refuses to run against a manifest that isn't marked `"synthetic": true`
unless `ACKNOWLEDGE_REAL_DATA=1` is set — see `docs/privacy-model.md`.

### CLI quirk worth knowing if you call the contract directly (not through the scripts)

`stellar contract invoke` accepts a bare hex string for a plain `BytesN<32>` argument (e.g.
`--batch_hash <hex>`), but **not** for an `Option<BytesN<32>>` argument like `--supersedes` — that
one needs a JSON string: `--supersedes '"<hex>"'` (quotes included). A bare hex value there fails
at argument parsing, before simulation — confirmed empirically to never reach the chain, so it's
safe to retry. `scripts/register-provenance.ts` already handles this (`JSON.stringify(hex)`).

## Reading a record without a local manifest

```
stellar contract invoke --id "$PROVENANCE_CONTRACT_ID" --source registrar --network testnet -- \
  get --batch_hash <hex>
stellar contract invoke --id "$PROVENANCE_CONTRACT_ID" --source registrar --network testnet -- \
  get_by_batch_id --batch_id <hex>
```

Both are read-only; the `--source` account funds transaction simulation but never signs anything
for a read.

## Independently confirming transaction history (bypassing the CLI entirely)

```
curl -s "https://horizon-testnet.stellar.org/accounts/<G...address>/transactions?order=asc&limit=20" \
  | python3 -m json.tool
```

Useful for building `docs/evidence.md` from ground truth rather than trusting captured CLI output.

## Known operational risk: Testnet resets

Stellar Testnet is periodically reset by SDF, which wipes all accounts and contracts. If the
contract ID in `docs/evidence.md` no longer resolves, redeploy with the steps above — the whole
sequence from "Testnet accounts" onward is meant to be safely re-runnable end to end.
