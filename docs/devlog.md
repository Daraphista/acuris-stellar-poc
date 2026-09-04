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

## 2026-09-04 — D1 split engine + transaction builder, live web demo, README rewrite

- Reviewer feedback on the submitted SOW read "the smart contract was not deployed yet" — root
  cause was presentation, not reality (the SOW text pre-dated the repo and never linked to it),
  but the fix chosen was to make the deployment self-evident rather than just re-explain it: a
  live demo a reviewer can click, plus a README structured around proving it in under a minute.
- Split `packages/canonical` into a pure, `Uint8Array`-based encoding core (`bytes.ts`,
  `encoding.ts`) plus two thin entry points: the existing Node/sync one (`index.ts`, unchanged
  public API) and a new browser/async one (`browser.ts`, `crypto.subtle`-backed, no `node:*`
  import anywhere in its graph). Guarded the refactor three ways before trusting it: 3 new
  Node-vs-WebCrypto parity tests, the untouched Rust suite (reads the same vector files) staying
  green, and `scripts/verify-provenance.ts` still passing against the live contract with zero
  code changes.
- Implemented `packages/settlement` for real: decimal/stroop conversion (pure BigInt, no float
  contamination), the 50/50 split engine with a fixed, documented remainder recipient, and the
  transaction builder. Found a genuine boundary while wiring a vector-driven test: Stellar
  payment amounts are a signed int64, one bit narrower than the u64 range the canonical digest
  fields allow generically — `fixtures/vectors/settlement-vectors.json`'s max-u64 vector is a
  valid digest input but not a payable amount. The builder now rejects that case explicitly
  rather than surfacing the SDK's cryptic error.
- Built `web/`: a live, deployed two-tab demo. Settlement rail signs with an ephemeral,
  Friendbot-funded, in-browser-only keypair (zero install for a reviewer); Provenance reads the
  live contract via read-only Soroban RPC simulation, plus an in-browser digest calculator
  pre-filled from the exact fixture the on-chain record currently resolves to. Confirmed the
  `Status` contract enum decodes to `["Active"]` (an array, not a bare string) by probing the
  live contract directly rather than assuming.
- Verified the whole thing against the actual running app, not just unit tests: drove both tabs
  through the browser, then independently re-checked the resulting settlement transaction via a
  raw Horizon query — 2 payment operations, `5 + 5 = 10` XLM to the real `acuris`/`partner`
  addresses, memo byte-equal to the displayed digest. Recorded in `docs/evidence.md`.
- Added the GitHub Pages `pages` job to CI and rewrote the root `README.md`.
- Test count: 49 (18 canonical + 16 settlement + 15 Rust), up from 30.

## 2026-09-05 — moved the demo's deploy target from GitHub Pages to Vercel

- Switched `web/`'s deployment from GitHub Pages to Vercel: removed the `pages` job from
  `.github/workflows/ci.yml` (Vercel deploys via its own GitHub integration, independent of this
  repo's CI), removed `web/public/CNAME` (a GitHub-Pages-specific mechanism — Vercel manages
  custom domains through its own dashboard + DNS instead), and added `web/vercel.json` pinning
  the build config (framework, build command, output directory) as code rather than leaving it
  to dashboard clicks alone.
- The intended live URL is still `testnet.acurismed.com` — a subdomain of the real
  [acurismed.com](https://acurismed.com) product site, kept separate so the Testnet demo can
  never affect the live company site. DNS for that subdomain hadn't actually been configured
  under the GitHub Pages plan either, so this was a clean point to switch.
- Also linked the real `acurismed.com` product from the README (top link bar and "Why this
  exists"), alongside — not instead of — the Stellar demo's own link, since the demo link is
  what actually lets a reviewer click through the settlement/provenance flows.
- Couldn't fully dry-run the Vercel build locally (`vercel build` requires an authenticated,
  linked project); validated the part that's actually in question — the npm-workspace install
  resolving `packages/canonical`/`packages/settlement` before `web`'s own build runs — by
  re-confirming `npm run build --workspaces` still succeeds from the repo root. Vercel's
  monorepo workspace detection (Root Directory set to `web`) is standard, documented behavior,
  but the first real Vercel deploy is still the actual proof.
