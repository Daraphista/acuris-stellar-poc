# Devlog

Short, dated entries — what changed and why. This is Phase 0 of the execution plan (unfunded
groundwork before SOW submission); see the SOW and `docs/architecture.md` for the funded-sprint
plan this leads into.

## 2026-09-03 — Repository setup, canonicalization spec, D2 contract deployed to Testnet

- Scaffolded the repository: MIT license, `.gitignore`, `.env.example`, pinned toolchain
  (`.nvmrc`, `rust-toolchain.toml`), npm workspaces.
- Wrote `docs/canonicalization.md` before any hashing code, per the reviewer feedback pattern
  observed on peer Instawards submissions (Rust/TypeScript digest divergence named as the top
  technical risk on a comparable proposal). Chose an explicit, length-prefixed fixed-field
  encoding over generic JSON canonicalization (RFC 8785/JCS) — zero dependencies, no escaping
  ambiguity, straightforward to reimplement identically in two languages.
- Implemented `packages/canonical` (TypeScript, zero runtime dependencies) and validated it three
  independent ways before trusting it: its own test suite (15 tests), a from-scratch Python
  reimplementation of the same spec cross-checked against all 8 generated vectors, and finally the
  Rust parity module below.
- Wrote `docs/privacy-model.md` and `docs/authorization.md`, then `contracts/provenance` (Soroban,
  Rust) against them: an append-only registry with admin/registrar roles, fail-closed duplicate
  rejection, and non-destructive supersession/revocation. 13 contract behavior tests plus 2
  cross-language parity tests (`canonical_check.rs`, an independent Rust reimplementation of the
  canonicalization spec, asserted against the same fixture vectors as the TypeScript suite) — all
  passing.
- Installed the toolchain (Rust 1.98.0 stable + `wasm32v1-none`, `stellar-cli` 28.0.0,
  `soroban-sdk` 27.0.6) and built the contract: 8,047-byte optimized WASM.
- **Deployed to Stellar Testnet** and exercised the full flow live: `init`, `set_registrar`, four
  `register` calls (a fresh registration, an unrelated second fresh registration, and a two-hop
  `supersedes` correction chain), both fail-closed negative cases (`DuplicateRecord`,
  `NotAuthorizedRegistrar`), and independent read-back verification. Full transaction hashes,
  contract ID, and WASM checksum are in `docs/evidence.md`, cross-checked against Horizon directly
  rather than only against CLI output.
- Wrote `scripts/register-provenance.ts` and `scripts/verify-provenance.ts` — found and fixed two
  real bugs while making them work against the live contract: the CLI needs a JSON-quoted string
  for an `Option<BytesN<32>>` argument (bare hex, which works for a plain `BytesN<32>`, fails at
  argument parsing) and the register script was silently swallowing the CLI's stderr, which is
  where the transaction hash actually gets printed on success.
- D1 (settlement rail) and the demo video are funded-sprint scope and not started.
