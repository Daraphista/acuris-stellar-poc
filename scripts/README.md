# scripts

Operational scripts, run against a deployed Testnet contract. See `docs/runbook.md` for full
prerequisites and `docs/architecture.md` for the flows these exercise.

- `register-provenance.ts` / `verify-provenance.ts` — **D2**, implemented. Hash a (synthetic)
  batch manifest, register it on the provenance contract, and independently re-derive the digest
  from the on-chain record to confirm it matches. `npm run provenance:register` /
  `npm run provenance:verify`.
- `setup-accounts.ts`, `settle.ts` — **D1**, funded-sprint scope (Weeks 1-2). Not yet implemented.
