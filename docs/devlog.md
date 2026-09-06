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
  re-confirming `npm run build --workspaces` still succeeds from the repo root.
- **The first real Vercel deploy failed**: `Cannot find module '@acuris-stellar-poc/settlement'`.
  Root Directory = `web` in the Vercel dashboard turned out not to work the way assumed — Vercel's
  own docs are explicit that a project's Root Directory sandboxes it from every file outside that
  directory, with no `..` escape, for *any* command (install, build). That's a hard platform
  constraint, not a workspace-detection gap to route around. Fixed by moving `vercel.json` to the
  repo root (deleting the `web/vercel.json` that assumed the wrong model) and leaving Vercel's
  Root Directory setting **unset** — the project now builds from the actual repo root, with
  `outputDirectory: "web/dist"` pointing at what the build produces. Verified with a from-scratch
  local rebuild (wiped every workspace's `dist/`, reinstalled, ran the exact `vercel.json`
  commands) before pushing a second time.
- **Second correction**: Vercel's own "New Project" import UI, when it detects an npm-workspaces
  monorepo with Root Directory set to a subdirectory, doesn't offer an easy way to blank Root
  Directory back out — and its own placeholder text for the Install Command field in that exact
  screen suggests `npm install --prefix=..`. That's the actual first-party-supported escape
  hatch: npm's `--prefix` flag treats the given directory as the project root for that command,
  which correctly reaches the real repo root's `package.json` (and its `workspaces` field) from
  inside `web/` without literally `cd`-ing anywhere. Reverted to `web/vercel.json` (Root
  Directory stays `web`, matching what the import wizard already has) with `installCommand:
  "npm install --prefix=.."` and `buildCommand: "npm run build --prefix=.."` — the latter
  delegates to the repo root's own `build` script, which is exactly `npm run build --workspaces
  --if-present`. `outputDirectory` stays the Vite-default `dist`, correctly resolving to
  `web/dist` since it's relative to Root Directory.
- Couldn't verify this one hands-on: hit the disk-space wall again (down to 121Mi free, worse
  than the ~211Mi seen earlier this project) mid-way through a local `--prefix=..` test, when
  wiping every `node_modules` to simulate a clean install ran the disk dry before npm could
  finish. The command semantics are standard, well-documented npm behavior and match exactly
  what Vercel's own UI suggests for this scenario, but the actual Vercel deploy is the real test
  this time, more than once already this project. The disk-space issue itself is now flagged to
  the user directly, not something this repo's tooling can fix.
- Rebuilt `web/` from the two-tab demo into a three-route console (`/`, `/settlement`,
  `/provenance`) after a design pass through Google Stitch produced a dense, mono-forward "ops
  console" system (Tailwind v4, Geist + JetBrains Mono, inline SVG icons instead of the Material
  Symbols webfont) meant to read as internal tooling rather than the AI-generated-looking navy
  gradient the previous version drew a critique for. Kept `lib/settlementRail.ts` and
  `lib/provenance.ts` as the seam and rebuilt everything above them.
- The mockups Stitch produced included substantial invented content — a fabricated Merkle proof,
  gas/CPU figures with no source, a fake streaming trace log, and "immutable" language where this
  reviewer has specifically asked for "tamper-evident." None of that was ported. Two genuinely
  useful ideas from the mockups *were* kept and made real: the console index now fetches the
  latest settlement and walks the live `supersedes` chain on load instead of showing a frozen
  snapshot, and the settlement success screen now independently re-reads the transaction's memo
  from Horizon (`confirmMemoOnChain`) rather than comparing its own computed digest to itself.
- Built failure-case panels for both routes, run for real: D2's two guards
  (`lib/provenanceFailures.ts`, `DuplicateRecord` / `NotAuthorizedRegistrar`, both rejected at
  simulation with no ledger write) and five of D1's negative cases
  (`lib/failureCases.ts`) — two refused client-side by the split engine and transaction builder
  (sub-2-stroop, int64 overflow) and three genuinely submitted to Testnet and rejected by Horizon
  (`op_underfunded`, `tx_too_late`, `tx_bad_auth` from a deliberately wrong network passphrase).
  The three D1 cases that aren't built yet (missing trustline, event replay, wallet-rejected
  signature) are listed as pending funded-sprint scope in the same panel rather than omitted.
- One real bug caught in testing, not left for later: the first pass at the network-level
  failure cases wrapped the memo digest in `Buffer.from(...)`, which doesn't exist in a browser —
  `Memo.hash()` already takes a raw `Uint8Array`. Fixed and re-verified live before considering
  the cases done.
- Verified end-to-end against live Testnet, not just `tsc`/build: ran a fresh settlement through
  the deployed page and independently confirmed via a direct Horizon query
  (`curl .../transactions/<hash>`) that the on-chain memo equals the digest the page displayed
  and that both payment amounts sum to the gross; ran both provenance failure cases and got the
  real `Error(Contract, #5)` / `#4` back from the live contract; ran all five settlement failure
  cases and got the real Horizon/client rejections back. All 34 existing TypeScript tests still
  pass. Also caught that `testnet.acurismed.com`'s DNS — recorded as unconfigured as of the
  previous entry — now resolves to Vercel; the domain was live, just still serving the old build
  until this deploy.
- Merged to `main` and pushed; Vercel's GitHub integration picked it up and the live site now
  serves the new console.

## 2026-09-06 — Instawards submission got the green light to proceed; sprint plan started

- Submission received a green light from Stellar to proceed (not yet funded/disbursed). Wrote
  `docs/sprint-plan.md`: a day-by-day breakdown of `docs/roadmap.md`'s remaining work into a
  30-day, one-commit-per-day cadence, sequenced by dependency (wallet connect before wallet
  signing before the reject-path negative case; trustlines before the missing-trustline negative
  case; etc.), with a weekly buffer day to absorb slippage.
- **Day 1 of the sprint plan**: decided `rotate_admin` — chose to document the explicit rationale
  for leaving it out of this PoC rather than implement it (`docs/authorization.md`). The admin key
  gates only `set_registrar`/`revoke`, not `register()` or any fund movement, so losing it
  degrades to "allow-list frozen" rather than "funds at risk" or "data lost," and is recoverable
  via redeploy+re-init — an acceptable Testnet-PoC failure mode, explicitly flagged as needing a
  real fix (a `rotate_admin` function or multi-admin model) before any production use.
- Noted for Day 2: local `cargo` isn't on `PATH` (rustup is installed via Homebrew, but no
  toolchain resolves) — needs fixing before `contracts/provenance/src/test.rs`'s new cases can be
  run locally.
