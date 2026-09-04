# Architecture

Both Testnet flows, how they fit together, and the trust boundary at each hop. Diagrams are
Mermaid — they render directly on GitHub.

## System overview

```mermaid
flowchart LR
    subgraph offchain["Off-chain (Acuris-controlled)"]
        RE["Revenue event\n(simulated, fixtures/)"]
        BM["Batch manifest\n(synthetic in this repo;\nreal manifest never leaves\nAcuris infrastructure)"]
        CANON["packages/canonical\n(TS, zero deps)"]
        SETTLE["packages/settlement\nsplit engine + XDR builder"]
        RE --> CANON
        BM --> CANON
        CANON --> SETTLE
    end

    subgraph browser["Browser harness (web/, static)"]
        KIT["Stellar Wallets Kit"]
        WALLET["User's wallet extension\n(Freighter / xBull / ...)\nholds the secret key"]
        KIT <--> WALLET
    end

    subgraph chain["Stellar Testnet"]
        HORIZON["Horizon\n(classic tx submission)"]
        RPC["Soroban RPC"]
        ANCHOR["testanchor.stellar.org\n(SEP-1 asset issuer)"]
        CONTRACT["Provenance contract\n(Soroban, Rust)"]
    end

    REVIEWER["Reviewer\n(stellar.expert / Soroban explorer)"]

    SETTLE -- "unsigned XDR" --> KIT
    KIT -- "signed XDR" --> HORIZON
    ANCHOR -. "trustline + asset" .-> HORIZON

    CANON -- "batch_hash (off-chain)" --> RPC
    RPC --> CONTRACT

    HORIZON --> REVIEWER
    RPC --> REVIEWER
```

## D1 — Revenue-Share Settlement Rail

```mermaid
sequenceDiagram
    participant Event as Revenue event (fixture)
    participant Settle as Split engine (TS)
    participant Kit as Stellar Wallets Kit
    participant Wallet as User wallet (Freighter)
    participant Horizon as Horizon (Testnet)
    participant Explorer as stellar.expert

    Event->>Settle: canonical event (docs/canonicalization.md)
    Settle->>Settle: compute settlement_digest (SHA-256)
    Settle->>Settle: split gross 50/50 (integer minor units)
    Settle->>Settle: build ONE tx: 2 payment ops + memo=settlement_digest
    Settle->>Kit: unsigned XDR
    Kit->>Wallet: request signature
    Wallet-->>Kit: signed XDR (secret key never leaves the wallet)
    Kit->>Horizon: submit signed XDR
    Horizon-->>Explorer: transaction hash, both ops visible
    Note over Horizon,Explorer: Reviewer confirms: 2 ops, amounts sum to gross,<br/>memo hash matches SHA-256 of the published event JSON
```

Both payment operations are in a **single classic transaction** — atomic by construction: either
both legs settle or neither does. The 50/50 ratio is computed by the off-chain split engine, not
enforced by on-chain code; a Soroban splitter contract that enforces the ratio in deployed code is
documented here as the natural next step for an SCF Build application, not built in this Instaward
(see "Deferred: on-chain-enforced split" below).

**Anchor role.** `testanchor.stellar.org` is used as the Testnet **asset issuer**: its
`stellar.toml` (SEP-1) is resolved to discover its test asset, both parties establish a trustline
to it, and settlement amounts move in that asset. This satisfies "integrate with a Testnet anchor"
without the interactive SEP-24 deposit UI, which is orthogonal to what D1 is actually
demonstrating (a split-payout mechanism) and would add a brittle popup-driven flow to the critical
path for no evidentiary benefit. SEP-10 web-auth against the anchor is a documented stretch item,
attempted only after D1 and D2 are otherwise complete.

### Instawards demo variant

`web/`'s live demo runs a deliberately smaller version of the sequence above, built so a reviewer
with nothing installed can watch a real settlement happen:

- **Ephemeral keypair instead of a wallet extension.** `Keypair.random()` is generated in the
  visitor's own browser tab, funded via Friendbot, and used to sign the one settlement
  transaction — then discarded. It never touches storage, logs, or the DOM; see
  `web/src/lib/settlementRail.ts`. This is strictly a demo-signing convenience: it does not
  replace Wallets-Kit signing as the funded-sprint target, which remains the plan for the
  production-shaped flow above.
- **Native XLM instead of the testanchor asset.** The demo pays out in native XLM — no
  trustline setup needed. The testanchor SRT asset and trustline flow described above are
  unchanged funded-sprint scope; the demo doesn't touch them.
- Everything else is identical: the same `packages/settlement` split engine and transaction
  builder, the same `settlement_digest` construction, one atomic transaction with 2 payment ops
  and a `MEMO_HASH`. The demo's first real transaction is recorded in `docs/evidence.md`.

**The remainder rule.** When the gross amount doesn't split evenly in two, `splitFiftyFifty`
(`packages/settlement/src/split.ts`) puts the odd minor unit on a **fixed** recipient — the
partner leg, not configurable — because a rule a caller could change is a rule a reviewer
couldn't verify from the published event JSON alone. A gross below 2 minor units is rejected
before it ever reaches a transaction builder: Stellar rejects a payment operation with a
non-positive amount, so a two-leg 50/50 split cannot express a gross of 0 or 1 at all.

## D2 — Clinical Data Provenance Contract

```mermaid
sequenceDiagram
    participant Manifest as Batch manifest (synthetic fixture)
    participant Canon as packages/canonical (TS)
    participant Script as register-provenance.ts
    participant Contract as Provenance contract (Soroban)
    participant Verify as verify-provenance.ts
    participant Explorer as Soroban explorer

    Manifest->>Canon: sorted (path, sha256) entries
    Canon->>Canon: batch_hash = SHA-256(domain_tag || manifest bytes)
    Script->>Contract: register(batch_id, batch_hash, terms_ref, supersedes)
    Note over Contract: require_auth(registrar) + allow-list check<br/>registered_at = ledger timestamp (not caller-supplied)<br/>duplicate batch_hash -> fails closed
    Contract-->>Explorer: ledger entry: Record{...}, tx hash
    Verify->>Contract: get(batch_hash)
    Contract-->>Verify: stored Record
    Verify->>Canon: recompute batch_hash from the same local manifest
    Verify->>Verify: assert recomputed == stored.batch_hash
```

The contract never receives the manifest itself — only the digest and the small metadata fields in
`docs/privacy-model.md`. `verify-provenance.ts` demonstrates independent verification: it re-derives
the digest locally from the (synthetic) manifest and checks it against what the deployed contract
returns, which is the reviewable claim in `docs/evidence.md`.

## Trust boundaries

| Boundary | What crosses it | What's actually verified there |
|---|---|---|
| Off-chain manifest → `batch_hash` | Nothing (only a digest is computed) | Anyone with the real manifest can recompute the same digest — this repo demonstrates it with a synthetic one |
| `register()` call | `require_auth()` signature + allow-list membership | The Soroban runtime enforces the signature; the contract enforces allow-list membership. Neither proves the signer is a real Acuris employee — that's an off-chain fact this project doesn't attempt to put on-chain |
| Revenue event → settlement transaction | Unsigned XDR built off-chain, signed in-wallet | Atomicity of the two payment ops; the memo ties the transaction back to a specific published event JSON |
| Chain → reviewer | Explorer view of a public transaction / contract | Confirms *that* an authorized party recorded specific bytes at a specific ledger time. Does **not** confirm the off-chain de-identification, terms content, or real-world business facts — see `docs/privacy-model.md`, "What the chain does not prove" |

## Deferred: on-chain-enforced split

A second Soroban contract could hold the 50/50 ratio and execute both token transfers itself via
a SEP-41 token client, making the ratio enforced by deployed code rather than by the transaction's
builder. Left out of this Instaward to keep Soroban risk concentrated in D2 (the team's first
contract) and because atomicity — not ratio-enforcement — is the property the E-Konsulta pilot
actually needs on day one. Recorded here as the concrete technical ask for a follow-on SCF Build
application.

## Repository layout

See the root `README.md` for the directory tree and how to run everything end-to-end.
