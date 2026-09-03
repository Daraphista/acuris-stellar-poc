<!-- markdownlint-disable MD033 -->
# Acuris Stellar PoC

Stellar Testnet proofs-of-concept built by **Acuris Med AI** for the Stellar Philippines
Instawards program: a verifiable settlement rail for revenue-share partnerships, and a
tamper-evident provenance registry for de-identified clinical data batches.

**Status:** Phase 0 (pre-submission groundwork) — see `docs/devlog.md`. Deliverable 2 is built,
tested, and deployed live to Testnet. Deliverable 1 is funded-sprint scope, not yet started.

## Problem

Acuris Med AI runs a clinical documentation platform for the Philippine healthcare and medical
transcription market, and has a signed Memorandum of Agreement with E-Konsulta Medical Clinic
(2026-06-24) structured as a 50% revenue-share on laboratory and prescription routing. The pilot
hasn't started volume yet, and two things are unbuilt:

1. **No settlement mechanism.** When the pilot starts, splitting and settling partner revenue
   falls back on manual bank transfers — slow, costly to reconcile, and leaving no independently
   verifiable record for either party.
2. **No provenance record.** Acuris holds its own de-identified clinical dataset used for
   ASR/LLM work, with no tamper-evident record of what that data is or the terms it may be used
   under.

The team had no prior Stellar or Soroban experience before this project.

## Solution

Two Stellar Testnet flows, deliberately kept separate from (and out-of-scope for changing) the
Acuris clinical product itself:

- **Settlement rail** — a simulated revenue event is split 50/50 and paid out atomically to a
  partner Testnet wallet in a single classic Stellar transaction, signed in-browser via
  **Stellar Wallets Kit**. See `docs/architecture.md`.
- **Provenance registry** — a minimal **Soroban** contract that registers a cryptographic digest
  of a de-identified data batch plus non-identifying metadata (batch id, terms reference, ledger
  timestamp), with fail-closed duplicate rejection and non-destructive supersession for
  corrections. **Deployed and exercised live on Testnet** — see `docs/evidence.md`.

Neither flow puts patient-identifiable data, clinical content, or real funds anywhere near the
chain. See `docs/privacy-model.md` for exactly what is and isn't on-chain, and why.

## Why Stellar

Both problems need the same two properties: a public, independently-checkable record, and cheap
atomic settlement — without operating our own ledger. Soroban's storage model (and its
`require_auth` authorization primitive) is a good fit for an append-only registry with a small,
explicit authorization surface; classic Stellar multi-operation transactions give atomic
2-way payouts for free, with no custom escrow contract needed for that part.

## What's actually built right now

| | Status |
|---|---|
| `docs/canonicalization.md` — the digest spec both languages implement | Done |
| `packages/canonical` — TypeScript implementation, 15 tests incl. cross-language vector parity | Done |
| `contracts/provenance` — Soroban registry contract, 15 tests incl. Rust-side parity check | Done |
| Deployed to Stellar Testnet, exercised end-to-end (4 registrations incl. a 2-hop correction chain, both negative cases) | Done — `docs/evidence.md` |
| `scripts/register-provenance.ts` / `verify-provenance.ts` | Done |
| D1 settlement rail (`packages/settlement`, `web/`) | Not started — funded sprint, Weeks 1-2 |
| Demo video | Not started — funded sprint, Week 4 |

## Quick start

```
nvm use && npm install
npm run build && npm test                    # TypeScript: canonicalization + vector parity
cargo test -p acuris-provenance-contract      # Rust: contract behavior + vector parity
```

Full toolchain versions, Testnet account setup, contract deploy/init, and how to register and
independently verify a record: see **`docs/runbook.md`** — every command there has actually been
run against live Testnet, not just written down.

## Evidence

Contract ID, WASM checksum, every transaction hash, and both live negative-case results:
**`docs/evidence.md`**.

## Documentation

| Doc | Covers |
|---|---|
| `docs/architecture.md` | Both flows end-to-end, sequence diagrams, trust boundaries |
| `docs/privacy-model.md` | Exactly what is/isn't on-chain; RA 10173 posture |
| `docs/canonicalization.md` | The digest spec — written before any hashing code existed |
| `docs/authorization.md` | Who can call what, key handling, duplicate/revision rules |
| `docs/evidence.md` | Contract ID, WASM hash, tx hashes, negative-case results |
| `docs/runbook.md` | Exact, verified reproduction commands |
| `docs/devlog.md` | Dated log of what was built and why |

## Scope boundaries

Testnet only — no Mainnet, no real XLM, no live partner funds, no token/NFT issuance, no PHI/PII
on-chain or in this repository, no clinic-facing or partner-facing UI. Full list in the project's
Statement of Work.

## Team

Angelo Raphael Mendoza — CTO & AI Engineering Lead, Acuris Med AI.

## License

MIT — see `LICENSE`.
