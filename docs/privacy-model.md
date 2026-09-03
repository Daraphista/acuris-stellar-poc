# Privacy Model

Scope: what this project puts on-chain, what it keeps off-chain, and why — mapped against the
Philippine Data Privacy Act (RA 10173). This document is normative for both deliverables; code
that would put a new field on-chain must be checked against it first.

## Boundary, stated once

**Nothing that identifies a patient, a clinical event, or clinical content ever leaves Acuris's
existing infrastructure.** Both Stellar flows only ever handle: a one-way cryptographic digest, a
small set of opaque or business-level identifiers, and a ledger timestamp. This repository — code,
fixtures, commit history, and CI artifacts — never contains real patient data. Where an example is
needed, it is synthetic and labeled as such (see "Synthetic fixtures" below).

## Deliverable 2 — Provenance contract

| Data | Where it lives | On-chain? |
|---|---|---|
| Raw de-identified clinical files (the batch itself) | Acuris-controlled storage, under Acuris's existing access controls | Never |
| Per-file SHA-256 + the assembled batch manifest | Computed off-chain at registration time; the manifest itself is not retained on-chain | Never |
| `batch_hash` — SHA-256 digest of the canonical manifest (`docs/canonicalization.md`) | Computed off-chain, submitted as a parameter to `register()` | **Yes** — `BytesN<32>` |
| `batch_id` | An opaque identifier Acuris assigns internally (e.g. an internal batch UUID). Must not be derived from, or encode, patient counts, dates of service, or clinic-visit identifiers | **Yes** — opaque bytes |
| `terms_ref` | A reference to (or digest of) the usage-rights/terms document governing that batch, not the document's content | **Yes** — opaque bytes |
| `registered_at` | Set by the contract from `env.ledger().timestamp()`, not caller-supplied | **Yes** — `u64` |
| `registrar` | The Stellar address that submitted the registration (an Acuris-controlled Testnet key for this PoC) | **Yes** — `Address` |

A `batch_hash` is a one-way function of file contents. It does not, by itself, allow reconstruction
of the underlying files, and reversing it is computationally infeasible. Its evidentiary value is
narrow and deliberate: it proves *that a specific batch existed in a specific state at a specific
time*, to anyone later shown the real files by Acuris under a data-sharing agreement — it does not
prove anything about the files' contents to someone who only has the hash.

## Deliverable 1 — Settlement rail

| Data | Where it lives | On-chain? |
|---|---|---|
| Revenue event (`event_id`, `source`, `asset_code`, `gross_amount_minor`, `occurred_at`, `partner_ref`) | Simulated input, `fixtures/revenue-events/` | The **digest** of this record is on-chain as `MEMO_HASH`; the record itself is not |
| `partner_ref` | An opaque reference to the counterparty (e.g. E-Konsulta as a business entity) | Digest only, as above — never a patient identifier, never a prescription or lab-order reference |
| Stellar public keys (Acuris, partner) | Testnet keypairs generated for this PoC | Yes, inherently — a Stellar address is not linked to a real-world identity in this Testnet context (no KYC/SEP-12 in scope) |

`gross_amount_minor` is a simulated figure for a synthetic event. No live E-Konsulta transaction
volume is processed under this Instaward — see the SOW's Assumptions & Prerequisites and
Out-of-Scope sections.

## RA 10173 (Data Privacy Act) posture

RA 10173 §3(g) defines personal information as data from which an individual's identity is
"reasonably and directly ascertainable." Everything written on-chain by this project is one of: a
cryptographic digest (not reversible to source content), an opaque business-assigned identifier
carrying no patient-linkable structure, or a ledger-assigned timestamp. None of it is personal
information under that definition, provided the input to D2 was properly de-identified before this
project ever sees it — which is an existing Acuris control this engagement assumes and does not
re-verify (see the SOW's Assumptions & Prerequisites; de-identification engineering is explicitly
out of scope).

## Synthetic fixtures

Every file under `fixtures/batch-manifests/` is synthetic and must declare `"synthetic": true` in
its JSON. `docs/evidence.md` records that this was checked before each submission, and the
verification checklist (this doc's sibling, `runbook.md`) includes a full-history grep for PHI
patterns and key material, not just a check of the current tree — a file removed in a later commit
still lives in git history.

## What the chain does *not* prove

Being explicit here follows directly from Armielyn's review feedback on Expoxur and INIT.AI: a
Stellar record proves that an authorized registrar's signed transaction caused a specific digest
and metadata to be recorded at a specific ledger time. It does **not** independently verify that
the off-chain de-identification was adequate, that the terms document says what Acuris claims, or
that the batch manifest was assembled correctly. Those remain Acuris-asserted, off-chain facts that
the chain anchors — it does not validate them. Documentation and the demo video state this
distinction explicitly rather than imply blockchain-verified compliance.
