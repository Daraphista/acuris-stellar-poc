# settlement

The D1 split engine and unsigned-transaction builder: computing a 50/50 revenue split in
integer minor units and building the one classic Stellar transaction (2 payment operations +
`MEMO_HASH`) that pays it out atomically. `web/` is a thin UI over this package, not a
reimplementation of it — see docs/architecture.md.

## API

- `parseDecimalToMinor(input, decimals?)` / `formatMinorAsDecimal(minor, decimals?)` —
  decimal-string ⇄ integer-stroop conversion, pure BigInt arithmetic throughout (no `Number` in
  the value path, so no float contamination at the boundary).
- `splitFiftyFifty({ grossMinor, acurisDestination, partnerDestination })` — splits an integer
  minor-unit amount 50/50. The odd unit, when gross is not evenly divisible by two, always goes
  to `REMAINDER_RECIPIENT` (fixed to `"partner"`, not configurable — a configurable remainder
  rule is one nobody could verify from the published event JSON). Throws if `grossMinor < 2`:
  Stellar rejects a payment operation with a non-positive amount, so a two-leg split cannot
  express a gross of 0 or 1 at all.
- `buildSettlementTransaction({ sourceAccount, split, settlementDigest, asset, networkPassphrase, ... })`
  — builds the unsigned transaction. `settlementDigest` is a caller-supplied input, not computed
  here, so this module never has to choose between `node:crypto` (sync) and WebCrypto (async);
  it imports `@acuris-stellar-poc/canonical` only via `import type`, so no `node:*` specifier
  ever enters its module graph, and it's safe to bundle for the browser demo.

## A real boundary, not an edge case

Stellar's classic ledger stores a payment amount as a **signed int64** count of minor units —
one bit narrower than the u64 range `docs/canonicalization.md`'s digest fields (and
`splitFiftyFifty`'s own input validation) allow generically. A split's remainder leg can land
exactly one unit past that ceiling even when the gross itself was a valid u64 (this is exactly
what `fixtures/vectors/settlement-vectors.json`'s `max-u64-amount-edge-case` vector hits — it's
a valid digest input, not a payable amount). `buildSettlementTransaction` checks for this
explicitly and throws a clear `SettlementTransactionError` before ever calling
`Operation.payment()`, rather than letting a cryptic SDK error surface. Unreachable by any real
settlement in this project (~922 billion XLM), but worth knowing about.

## Tests

`node --test dist/test/*.test.js` (or `npm test`, from this directory or the repo root):
decimal round-tripping, a `sum(legs) === grossMinor` property test over 10,000 random draws plus
explicit boundaries past `Number.MAX_SAFE_INTEGER`, and a vector-driven test asserting the
transaction's memo bytes equal the exact digest `fixtures/vectors/settlement-vectors.json` pins
— the proof that the on-chain memo is the same digest the Rust contract suite also checks
against.
