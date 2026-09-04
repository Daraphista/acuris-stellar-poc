# web

A static Vite + React Testnet demo, deployed to GitHub Pages. Two tabs, both live against the
real deployed contract and real funded Testnet accounts documented in `docs/evidence.md` — see
that file for the transaction this demo itself produced.

- **Settlement rail (D1).** Generates an ephemeral Testnet keypair in the visitor's own browser
  tab, funds it via Friendbot, splits a gross amount 50/50 via `packages/settlement`, signs with
  the ephemeral key, and submits to Horizon. Zero install for the visitor — no wallet extension
  required. This is the demo variant of D1; the Stellar-Wallets-Kit + testanchor-asset path
  described in `docs/architecture.md` remains funded-sprint scope.
- **Provenance (D2).** Looks up a `batch_id` against the live Soroban contract via a read-only
  RPC simulation (nothing is signed or submitted), plus an in-browser digest calculator using
  `@acuris-stellar-poc/canonical/browser` that reproduces the on-chain `batch_hash`.

## Why an ephemeral keypair instead of a wallet extension

A reviewer with no Freighter (or similar) installed would otherwise see a dead page. The
ephemeral-key path lets anyone open the link and watch a real transaction land on Testnet with
no setup. The secret key is generated per visit, lives only in that tab's memory, and is never
persisted, logged, or put in the DOM — see `src/lib/settlementRail.ts`.

## Local development

```
nvm use && npm install
npm run dev -w web
```

`npm run build -w web` runs `tsc --noEmit` then `vite build`; there's no separate browser test
runner — the split engine, transaction builder, and canonicalization logic all live in
`packages/settlement` and `packages/canonical`, which do have real test suites, and this UI is
deliberately a thin layer over them.
