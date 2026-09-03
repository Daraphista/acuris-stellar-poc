# Authorization Model

Who can do what, on which flow, and how the keys involved are handled. Written before contract
implementation; `contracts/provenance/src/lib.rs` implements exactly this.

## D2 — Provenance contract

Three roles, all Stellar `Address` values (Testnet keypairs for this PoC):

| Role | Can do | Cannot do |
|---|---|---|
| **admin** | `set_registrar(addr, allowed)` — add/remove a registrar; `revoke(batch_hash)` — mark a record `Revoked` | Cannot `register()` directly unless also added as a registrar |
| **registrar** (allow-listed by admin) | `register(batch_id, batch_hash, terms_ref, supersedes)` | Cannot manage the allow-list, cannot revoke, cannot register on another registrar's behalf |
| **anyone (no auth)** | `get(batch_hash)`, `get_by_batch_id(batch_id)` — read-only | Cannot write |

- `admin` is set once, at `init(admin: Address)`, called exactly once at deployment. There is
  **no `rotate_admin` function in this version** — a deliberate scope limit, not an oversight,
  called out here so a reviewer doesn't have to guess. Future work: an admin-rotation or
  multi-admin path before any production use.
- Every write path calls `caller.require_auth()` — the transaction must be signed by the address
  claiming to act, enforced by the Soroban runtime, not by application logic that could be
  bypassed.
- `register()` additionally checks the caller is on the registrar allow-list. A valid signature
  proves control of a key; it does not by itself prove the signer is an authorized Acuris
  registrar — the allow-list is what encodes that authorization, and it is admin-controlled.

### Duplicate and revision handling

- Registering a `batch_hash` that already exists fails closed with `Error::DuplicateRecord` —
  it does not silently overwrite.
- A corrected batch is registered as a **new** record, with `supersedes = Some(prior_batch_hash)`.
  On success, the prior record's status transitions `Active → Superseded`. The prior record is
  never deleted or overwritten — history is append-only, and a reviewer can walk the
  `supersedes` chain from any record back to its origin.
- `revoke()` (admin-only) transitions a record to `Revoked`, for cases outside simple
  supersession (e.g. a batch registered in error). Revocation is also non-destructive — the
  record and its history remain readable via `get()`.

## D1 — Settlement rail

No custody model to design here beyond "never touch a secret key," because the architecture is
built to avoid needing one:

- The split engine (`packages/settlement`) computes the two payout amounts and constructs an
  **unsigned** transaction envelope (XDR). It never has access to, requests, or stores a secret
  key.
- The Testnet browser harness (`web/`) uses **Stellar Wallets Kit** to request a signature from
  the user's own wallet (Freighter, xBull, etc.). The secret key never leaves the wallet extension.
- A thin submit path relays the now-signed XDR to Horizon. It does not modify it.
- For scripted (non-browser) demonstration and CI, a Testnet-only signing key is read from an
  environment variable (`.env`, gitignored) — this key controls no real funds, is funded solely
  by friendbot, and is treated as disposable: regenerating it is a documented one-line runbook
  step, not an incident.

## Key handling, summarized

No secret key — Testnet or otherwise — is ever committed to this repository, at any commit. All
deployment and scripted-signing commands in `docs/runbook.md` reference environment variables.
`docs/evidence.md` records the verification that the full git history was swept for key material
before submission, matching this document's requirement.
