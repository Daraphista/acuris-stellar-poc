# Canonical Encoding & Hashing Specification

Status: **authored before any hashing implementation** (this repo's `packages/canonical` and the
Rust parity test in `contracts/provenance` are both written against this document, not the other
way around). Any change here requires re-deriving `fixtures/vectors/*.json` and re-running both
test suites.

## Why this document exists

This project computes the same cryptographic digest in two independent language runtimes:
TypeScript (off-chain tooling, `packages/canonical`) and Rust (a parity check inside the Soroban
contract's test suite, `contracts/provenance/src/canonical_check.rs`). If the two implementations
ever disagree on how a value is encoded before hashing, the on-chain record and the off-chain
evidence silently stop matching — which is exactly the failure mode a "tamper-evident" claim
cannot survive. This document is the single source of truth both implementations are written
against, and `fixtures/vectors/` is the executable proof they agree.

We deliberately do **not** use a generic JSON canonicalization scheme (e.g. RFC 8785 / JCS).
JCS is designed for arbitrary JSON documents and carries real subtlety (UTF-16 code-unit key
ordering, IEEE-754 number-to-string edge cases, nested-structure recursion) that is difficult to
verify byte-for-byte across two hand-written implementations. Our inputs are two small, fixed-shape
records — a generic canonicalizer is more surface area than the problem needs. Instead we use an
explicit, fixed-field, length-prefixed encoding, defined field-by-field below. It has no escaping
ambiguity, no recursion, and can be read and re-implemented correctly from this document alone.

## Digest construction (common to both objects)

```
digest = SHA-256( domain_tag_bytes || 0x00 || canonical_bytes )
```

- `domain_tag_bytes` — the ASCII bytes of the domain tag string for that object type (below). The
  domain tag prevents a valid encoding of one object type from ever colliding with another, and
  lets us version the encoding later (`.v2`) without ambiguity against `.v1` data.
- `0x00` — a single separator byte between the domain tag and the payload.
- `canonical_bytes` — the field-by-field encoding defined per object type below.

### Field encoding primitive: `LP` (length-prefixed)

Every field value, after normalization, is encoded as:

```
LP(value) = uint32_BE(byte_length(utf8(value))) || utf8(value)
```

A 4-byte big-endian length prefix followed by the UTF-8 bytes. This is what removes the need for
delimiters or escaping: a value may contain any byte sequence, including newlines or the literal
text used elsewhere as a separator, without changing how it is parsed.

Fields are concatenated as `LP(field_1) || LP(field_2) || ...` in the **fixed order given below** —
order is part of the spec, not derived from the data.

### String normalization (applied before `LP`)

1. Must be valid UTF-8.
2. Normalized to **Unicode NFC**.
3. Must not contain C0 control characters (`0x00`–`0x1F`) or `0x7F`. Reject the input; never strip
   silently — a rejected input is safer than a silently-altered one.
4. No implicit trimming. Leading/trailing whitespace is significant and is the caller's
   responsibility to avoid.

### Integer normalization (applied before `LP`)

Integers are encoded as their **minimal decimal ASCII string**: no leading zeros (except the value
`0` itself), no leading `+`, no sign for values that are defined as non-negative. Value range for
this project's fields is `0 ..= 18446744073709551615` (fits `u64` / JS `bigint`); implementations
must reject out-of-range input rather than silently truncate.

### Timestamp normalization

RFC 3339, UTC, second precision, literal `Z` suffix — e.g. `2026-09-03T14:05:00Z`. No fractional
seconds, no numeric offset. Reject anything else at the boundary rather than reformat it.

## Object 1 — Batch Manifest (`acuris.batch-manifest.v1`)

Used by **D2**. This is an off-chain artifact only — it never touches the chain and never leaves
Acuris infrastructure for the real dataset. Its digest (`batch_hash`) is what gets written on-chain
by `register()`. This repository ships only synthetic manifests (`fixtures/batch-manifests/`) as
stand-ins for the real, larger corpus.

A manifest is a list of `(relative_path, sha256_hex)` entries, one per file in the de-identified
batch, where `sha256_hex` is the lowercase-hex SHA-256 of that file's raw bytes.

**Canonicalization:**

1. Sort entries ascending by `relative_path`, byte-wise on the UTF-8 encoding (i.e. ordinary
   `Array.prototype.sort()` in JS on strings, `Vec::sort()` on `&str` in Rust — both are byte-wise
   for ASCII paths; non-ASCII paths must additionally be NFC-normalized per the string rule above
   before comparison, so both languages compare the same bytes).
2. Reject duplicate `relative_path` values.
3. `sha256_hex` must be exactly 64 lowercase hex characters.
4. `canonical_bytes = concat over sorted entries of: LP(relative_path) || LP(sha256_hex)`

```
batch_hash = SHA-256( "acuris.batch-manifest.v1" || 0x00 || canonical_bytes )
```

`batch_hash` is a 32-byte value, stored on-chain as `BytesN<32>`.

## Object 2 — Revenue Event (`acuris.settlement.v1`)

Used by **D1**. The digest of a revenue event becomes the Stellar transaction's `MEMO_HASH` (which
is natively a 32-byte field — no truncation needed) on the settlement payout transaction. This is
what lets a reviewer independently confirm that a specific input event produced a specific
on-chain transaction, without trusting Acuris's word for it.

Fixed field order:

| # | Field | Type | Normalization |
|---|---|---|---|
| 1 | `event_id` | string | string rules above |
| 2 | `source` | string | string rules above |
| 3 | `asset_code` | string | string rules above |
| 4 | `gross_amount_minor` | integer, as string | integer rules above |
| 5 | `occurred_at` | string | timestamp rules above |
| 6 | `partner_ref` | string | string rules above |

```
canonical_bytes = LP(event_id) || LP(source) || LP(asset_code) || LP(gross_amount_minor)
                || LP(occurred_at) || LP(partner_ref)

settlement_digest = SHA-256( "acuris.settlement.v1" || 0x00 || canonical_bytes )
```

## On-chain fields are out of scope for this document

The Soroban contract's storage fields (`batch_id`, `terms_ref`, `registered_at`, `registrar`,
`status`, `supersedes`) are plain Soroban SDK types (`BytesN<32>`, `Bytes`, `u64`,
`Address`, an enum, `Option<BytesN<32>>`) serialized by the SDK's own XDR encoding. There is only
one implementation reading and writing them — the contract itself — so there is no cross-language
agreement to specify. Canonicalization only matters where two independent implementations must
derive the same bytes from the same logical value, which is the off-chain/on-chain hash boundary
above. Notably, `registered_at` is **never caller-supplied** — the contract sets it from
`env.ledger().timestamp()` so a registrar cannot backdate a record. See `docs/authorization.md`.

## Test vectors

`fixtures/vectors/batch-manifest-vectors.json` and `fixtures/vectors/settlement-vectors.json` each
contain `{ input, expected_domain_tag, expected_digest_hex }` cases, including at least one
edge case per object (empty-string field where legal, maximum-length integer, a path requiring NFC
normalization). Both `packages/canonical/test` (TypeScript) and
`contracts/provenance/src/canonical_check.rs` (Rust, test-only — not part of the deployed contract)
assert against the same files. CI (`.github/workflows/ci.yml`) runs both suites on every push;
a vector mismatch is a build failure, not a warning.
