# Evidence Manifest

Maps each acceptance criterion to a concrete, independently-checkable artifact. Everything under
"Deliverable 2" and "Deliverable 1" below is real Testnet state — reproducible end-to-end via
`docs/runbook.md`, and cross-checked against Horizon directly (not just CLI or page output) where
noted.

Network throughout: **Stellar Testnet** (`Test SDF Network ; September 2015`). Nothing here is
Mainnet, and no real funds or real clinical data are involved anywhere in this manifest.

## Deliverable 2 — Clinical Data Provenance Contract

### Contract

| Field | Value |
|---|---|
| Contract ID | `CCTYK4O5YMMCA2JYXVZRHDGKTJBBX56ALHRR3BBW32K4Y7RPCWBYFJ77` |
| WASM hash | `5d5096d703b69a1fb63740ca75b5fe8e301ba3488839967268b55b503f336f3e` |
| WASM size | 8,047 bytes optimized (source 8,871 bytes) |
| Exported functions | `get`, `get_by_batch_id`, `init`, `register`, `revoke`, `set_registrar` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CCTYK4O5YMMCA2JYXVZRHDGKTJBBX56ALHRR3BBW32K4Y7RPCWBYFJ77 |
| Built with | `soroban-sdk` 27.0.6, Rust 1.98.0, target `wasm32v1-none`, `stellar-cli` 28.0.0 |

### Identities (Testnet only — no real-world funds behind any of these)

| Role | Address |
|---|---|
| admin | `GC6WPNFAF3FCUN64VUYWYQP2W3WB46IRX6XMNYL6PX2ZYEY7YEHDNNV5` |
| registrar | `GD6LSNZIY3A6VU2IICGUZYODKZZZO2GEO74ZUO3K3SK2PGUZ5EV66OJL` |
| acuris (D1) | `GCNSHF5IZWGJ2G4TT5U2EQSC7BHGGZJ6M3WYQZA4IK5CURY6G55AI64D` |
| partner (D1) | `GBJ2NHWARQWMVZZI6V2P2VSXNV4WEFCFYOBRYK6JFV6BXO4QANQLZZTM` |

### Transactions (positive path)

All confirmed independently via `GET horizon-testnet.stellar.org/accounts/<addr>/transactions`,
not just CLI output — see `docs/runbook.md`, "Independently confirming transaction history".

| # | What | Tx hash | Explorer |
|---|---|---|---|
| 1 | Upload contract WASM | `4849c085fdb6cbe64a515b8b19bd3068bd119d4da3588cbf3154f735598d399e` | [view](https://stellar.expert/explorer/testnet/tx/4849c085fdb6cbe64a515b8b19bd3068bd119d4da3588cbf3154f735598d399e) |
| 2 | Create contract instance | `8c18d337e7d4c8e6a6a8c601248e56b809732d66b63425ff8e3d23ba571651c3` | [view](https://stellar.expert/explorer/testnet/tx/8c18d337e7d4c8e6a6a8c601248e56b809732d66b63425ff8e3d23ba571651c3) |
| 3 | `init(admin)` | `f927d9a59f409952de033a0c139c57e8748c803f54e7b92049753e6bbb9fb3dc` | [view](https://stellar.expert/explorer/testnet/tx/f927d9a59f409952de033a0c139c57e8748c803f54e7b92049753e6bbb9fb3dc) |
| 4 | `set_registrar(admin, registrar, true)` | `f2c008ba26d2e9900b19ce2ce547ca0643b632cdc272cb0cb0b1dbef0292b942` | [view](https://stellar.expert/explorer/testnet/tx/f2c008ba26d2e9900b19ce2ce547ca0643b632cdc272cb0cb0b1dbef0292b942) |
| 5 | `register` — `batch_0001.synthetic.json`, fresh | `0fc740680925fffbf98d6d0da20b6d9ae153cd207044c60154a805ad8143e7c1` | [view](https://stellar.expert/explorer/testnet/tx/0fc740680925fffbf98d6d0da20b6d9ae153cd207044c60154a805ad8143e7c1) |
| 6 | `register` — `batch_0002.synthetic.json`, fresh, via `register-provenance.ts` | `884ba17f0455d1decf4a377fa2d7ba7f91585d167627528d97bb07509814cad5` | [view](https://stellar.expert/explorer/testnet/tx/884ba17f0455d1decf4a377fa2d7ba7f91585d167627528d97bb07509814cad5) |
| 7 | `register` — `batch_0001_corrected...`, `supersedes` original | `248ad77c0bdaa90b4bcf69e6cbd4e7111212edc34554eb210e174ce82cfc9e30` | [view](https://stellar.expert/explorer/testnet/tx/248ad77c0bdaa90b4bcf69e6cbd4e7111212edc34554eb210e174ce82cfc9e30) |
| 8 | `register` — `batch_0001_corrected_v2...`, `supersedes` corrected, via `register-provenance.ts` | `bfdbc8883f5d25b516cba73296d81688e37895698703b4e0e47e7ca0585f6f42` | [view](https://stellar.expert/explorer/testnet/tx/bfdbc8883f5d25b516cba73296d81688e37895698703b4e0e47e7ca0585f6f42) |

A reviewer can independently confirm: the multi-hop chain `batch_0001 → corrected → corrected_v2`
(three distinct `batch_hash` values, two `supersedes` links) plus the unrelated `batch_0002`, all
against one deployed contract, all with real Testnet transaction hashes.

### Negative cases (confirmed live, not just in unit tests)

Both fail **at simulation**, before submission — correctly, they never reach the ledger, so there
is no transaction hash to link (that absence is itself the evidence: nothing was written).

| Case | Attempted call | Result |
|---|---|---|
| Duplicate registration | `register` with an already-registered `batch_hash` (the original `batch_0001` hash, after a fresh registration) | `HostError: Error(Contract, #5)` = `DuplicateRecord` |
| Unauthorized registrar | `register` signed by `acuris` (not allow-listed) | `HostError: Error(Contract, #4)` = `NotAuthorizedRegistrar` |

Both error codes match `contracts/provenance/src/types.rs::Error` exactly; see
`docs/runbook.md` for the literal commands.

### Read path

`get_by_batch_id` for `batch-0001-synthetic` (hex `62617463682d303030312d73796e746865746963`)
resolves to the newest record in the chain (`corrected_v2`, `status: Active`) — confirming the
secondary index tracks corrections rather than the first-ever registration.

### Automated tests

| Suite | Location | Count | What it covers |
|---|---|---|---|
| TypeScript — canonicalization | `packages/canonical/test/*.test.ts` | 18 | Encoding primitives, both digest functions, vector-file parity, and Node-vs-WebCrypto (sync-vs-async) digest parity for the browser entry point |
| TypeScript — settlement | `packages/settlement/test/*.test.ts` | 16 | Decimal/stroop conversion, the 50/50 split engine (incl. a `sum(legs) === gross` property test over 10,000 random draws), and the transaction builder, vector-driven against the same fixtures |
| Rust — contract behavior | `contracts/provenance/src/test.rs` | 13 | init/admin/registrar auth, duplicate rejection, supersession (incl. rejecting a non-Active `supersedes` target), revoke, not-found paths |
| Rust — cross-language parity | `contracts/provenance/src/canonical_check.rs` | 2 | Independent Rust reimplementation of `docs/canonicalization.md`, asserted against the same `fixtures/vectors/*.json` the TypeScript suite uses |

Run with `npm test` (builds and tests every TypeScript workspace, including a type-check of
`web/`) and `cargo test -p acuris-provenance-contract` (see `docs/runbook.md`). All 49 tests
pass as of this writing.

### Manifests used

`fixtures/batch-manifests/*.synthetic.json` — every file in this directory declares
`"synthetic": true` per `docs/privacy-model.md`; none contains real patient data or real file
content. `scripts/register-provenance.ts` refuses to run against a manifest missing that flag
unless explicitly overridden.

## Deliverable 1 — Revenue-Share Settlement Rail

The split engine and transaction builder (`packages/settlement`) and the live demo (`web/`) are
built and exercised on Testnet — see `docs/roadmap.md` for what's still funded-sprint scope
(Stellar-Wallets-Kit signing, the testanchor SRT asset and trustlines, the full negative-case
matrix). What's below is the demo's own first real settlement, run through the actual deployed
page, not a script — and independently re-checked against raw Horizon, not just the page's own
report.

| Field | Value |
|---|---|
| Transaction hash | `f31e14e88b0dad94317e52bc74d5ebf2b9ef7bdf4a988b288209697f210f9e83` |
| Explorer | https://stellar.expert/explorer/testnet/tx/f31e14e88b0dad94317e52bc74d5ebf2b9ef7bdf4a988b288209697f210f9e83 |
| Ephemeral signer (generated in-browser, discarded on refresh) | `GDPGE4VQG2MGUGMFIT6TE3THO25FSENIXDPJ2PZ6AJLELNZLEY3SDUH3` |
| Gross | 10.0000000 XLM (native) |
| Leg 1 | 5.0000000 XLM → `acuris` (`GCNSHF5I...I64D`) |
| Leg 2 | 5.0000000 XLM → `partner` (`GBJ2NHWA...ZZTM`) |
| `settlement_digest` (`= SHA-256("acuris.settlement.v1" \|\| 0x00 \|\| canonical event bytes)`) | `3dc4327df5a98c01508d24a4aaf9e106588cc0f9decc03a6125e52895c61c4f4` |
| On-chain memo (`MEMO_HASH`, confirmed via `GET horizon-testnet.stellar.org/transactions/<hash>`) | `3dc4327df5a98c01508d24a4aaf9e106588cc0f9decc03a6125e52895c61c4f4` |

The memo matches the digest exactly, and the two payment amounts sum to the gross exactly — both
confirmed by querying Horizon directly (`/transactions/<hash>` and `/transactions/<hash>/operations`),
independent of anything the page itself displays. `packages/settlement`'s own vector-driven test
(`test/transaction.test.ts`) asserts this same invariant — that the built transaction's memo
equals `fixtures/vectors/settlement-vectors.json`'s pinned digest — for every vector whose amount
is actually payable on classic Stellar (see that package's README for the one vector that isn't:
a valid digest input one unit past what a signed-int64 payment amount can express).

## Deliverable 3 — Verification, Documentation & Evidence Package

This document, `docs/architecture.md`, `docs/privacy-model.md`, `docs/canonicalization.md`,
`docs/authorization.md`, and `docs/runbook.md` are the D3 documentation set, in progress from
Phase 0 onward. The demo video and full end-to-end negative-case matrix are funded-sprint,
Week 4 scope.
