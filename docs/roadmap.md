# Roadmap

Forward-looking counterpart to `docs/devlog.md`. Updated as work happens — if this and the devlog
ever disagree about what's done, the devlog (and `git log`) win.

## Where this starts from

As of 2026-09-04 (see `docs/devlog.md`): **D2's core registry is done** — built, tested (49
passing tests across both languages, up from 30 as of the previous entry), deployed live to
Testnet, and exercised end-to-end including both negative cases. That's ahead of where the
original SOW draft assumed it would be at this point (it scoped D2 as Week 3 of the *funded* 30
days). **D1 is no longer 0% built**, still ahead of schedule: `packages/settlement` (the split
engine and transaction builder — Week 1 foundations, below) and a live demo at `web/` (Week 2's
harness, below, in a smaller variant) both exist and have run a real transaction on Testnet — see
`docs/evidence.md`. What's still outstanding from D1's funded scope: Stellar-Wallets-Kit signing
(the demo signs with an ephemeral in-browser keypair instead), the testanchor SRT asset and
trustlines (the demo pays in native XLM instead), and the full negative-case matrix below. D3 is
partial — most of the documentation set exists; testing, the demo video, and the full
negative-case matrix don't.

**Reallocation call**: rather than run the original per-deliverable hour split (D1 70 / D2 65 /
D3 31) as if D2 were still unbuilt, redirect most of D2's remaining budget toward D1 (the larger,
fully-unbuilt piece) and D3 (more thorough testing and a stronger demo), with a smaller slice left
for D2 hardening — the things deliberately deferred when it was built (see `docs/authorization.md`
"future work" notes, and the negative-case list below). Total stays 166 hrs to match the SOW ask.

| | Original SOW draft | This roadmap |
|---|---|---|
| D2 | 65 hrs | ~15 hrs (hardening + integration only — core is done) |
| D1 | 70 hrs | ~95 hrs |
| D3 | 31 hrs | ~56 hrs |
| **Total** | **166 hrs** | **166 hrs** |

If this reallocation isn't what's wanted — e.g. banking the extra time as slack instead, or
spending it on the deferred Soroban splitter contract (`docs/architecture.md`, "Deferred:
on-chain-enforced split") to strengthen the SCF Build follow-on story — this doc is the place to
change it before Week 1 starts.

## Before the 30-day clock starts (remaining Phase 0)

Unfunded, a few hours, not part of the 166:

1. Resolve `testanchor.stellar.org`'s `stellar.toml` (SEP-1) and establish trustlines for the
   `acuris` and `partner` Testnet accounts (already funded — see `docs/evidence.md`). This is D1
   prep that Phase 0 didn't reach.
2. Apply the recommended SOW edits (drafted, not yet in the document): submission date; soften
   D2's dataset language to "representative"; remove the named Soroban contractor line since this
   is solo-executed; add on-chain field/hash/authorization specifics to §4.1; add an evidence
   checklist to §6.1; cite this repo and the live contract as capability evidence; **and now an
   8th**: update §5's weekly table — "Week 3: Build D2" is stale, replace with the reallocation
   above.
3. Create the public GitHub repo and push (holding for an explicit go-ahead on which account/org).
4. Submit.

## Week 1 — D2 hardening, D1 foundations (~40 hrs)

**D2 hardening (~15 hrs, all weeks — front-loaded here since it's small and unblocks nothing else):**
- Decide and document admin rotation: either implement `rotate_admin` or write a short, explicit
  rationale for leaving it out of a 30-day Testnet PoC. Currently just a "future work" note in
  `docs/authorization.md` — needs a real decision either way.
- Extend `contracts/provenance/src/test.rs` with the cases not yet covered: `set_registrar`
  revoking an existing registrar (`allowed: false`) and confirming a subsequent `register` then
  fails; `revoke` on an already-`Revoked` record; TTL extension behavior around the threshold.
- A short security self-review checklist in `docs/evidence.md` — the kind of thing Armielyn asked
  Doghouse Certified for explicitly (acceptance-criterion-to-artifact mapping, plus a stated list
  of what was and wasn't checked).

**D1 foundations (~25 hrs, partly done ahead of schedule — see below):**
- ~~`packages/settlement`: the split engine — integer-minor-unit arithmetic, the `sum(legs) ==
  gross` property test, and the unsigned-XDR builder for the atomic two-payment-operation
  transaction described in `docs/architecture.md`.~~ **Done** — 16 tests including the property
  test over 10,000 random draws, and a vector-driven test tying the transaction's memo to the
  same pinned digests the Rust suite checks. `@stellar/stellar-sdk` (pinned `17.0.1`, the first
  version needing no Buffer polyfill for a browser bundle) added as a dependency here;
  `packages/canonical` stays dependency-free, now split into Node (sync) and browser (async)
  entry points so both `packages/settlement` and `web/` can use it. See `docs/evidence.md`.
- `scripts/setup-accounts.ts`: SEP-1 discovery against `testanchor.stellar.org`, trustline
  establishment for `acuris`/`partner` — **still outstanding**. The demo variant below pays in
  native XLM specifically to avoid needing this first; it's still needed for the
  Wallets-Kit-signed, anchor-asset flow `docs/architecture.md` describes as the funded-sprint
  target.

## Week 2 — D1 complete (~45 hrs)

- ~~`web/`: the Vite + React ... harness — connect, show the computed split, sign, submit, display
  the resulting tx hash and explorer link. Static build.~~ **Done, in a smaller variant** — see
  `docs/architecture.md`'s "Instawards demo variant". The harness exists, is deployed, and has
  produced a real settlement transaction (`docs/evidence.md`), but it signs with an ephemeral
  in-browser keypair rather than Stellar Wallets Kit, and pays in native XLM rather than the
  testanchor asset. Swapping in real wallet signing and the anchor asset is what's left of this
  item, not building the harness from scratch.
- Wire `scripts/settle.ts`: revenue event in, split computed, unsigned XDR out — **still
  outstanding**. `web/` calls `packages/settlement` directly today; a standalone CLI script
  (matching how `register-provenance.ts` works for D2) hasn't been written.
- ~~First real end-to-end simulated payout on Testnet~~ **Done** — recorded the moment it existed,
  same discipline D2's evidence was held to. See `docs/evidence.md`.
- ~~Add the `pages` job to `.github/workflows/ci.yml`~~ **Done** and deployed.

## Week 3 — D1 negative cases, integration, D3 depth (~45 hrs)

- Work through D1's negative-case list from `docs/architecture.md`: missing trustline,
  insufficient balance, indivisible remainder, duplicate `event_id` replay, user-rejected
  signature, expired time bounds, wrong network passphrase, RPC failure. Same standard D2 was
  held to — confirmed live, not just unit-tested.
- Full integration test pass across *both* flows together, not just each in isolation.
- Update `docs/evidence.md` with D1's contract... (no contract — with D1's transaction hashes,
  explorer links, and negative-case results, same format as the D2 section already there).
- If ahead of schedule: attempt the SEP-10 web-auth stretch item (`docs/architecture.md` names it
  explicitly as optional), or start the Soroban splitter contract prototype for the SCF story.

## Week 4 — Verification, demo, submission package (~36 hrs)

- Full negative-case matrix confirmed live for both flows in one pass, not re-litigated piecemeal.
- Privacy sweep of the *entire* git history (not just the current tree) for PHI patterns and key
  material — the check `docs/privacy-model.md` and `docs/runbook.md` both call for.
- Record the 3–5 minute demo video: both flows, plus at least one failure case, against public
  Testnet evidence — per the SOW's D3 requirement and Armielyn's standing feedback on peer
  submissions ("the demo should show independent verification, not only a successful UI").
- Final pass on every doc in `docs/` — in particular re-verify `docs/runbook.md` still works
  clean-room (wipe and rebuild again, the way Phase 0's commits were verified).
- Package the completion evidence for the Ambassador Chapter Lead review.

## How to keep this current

Update this file's "Where this starts from" section whenever a week's real outcome diverges from
what's written above — which it will; this is genuinely new territory. Small, frequent commits to
this doc alongside the code are more useful than a perfect plan kept static for 30 days.
