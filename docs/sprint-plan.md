# 30-Day Sprint Plan

Day-by-day commit plan for the funded Instawards sprint. Companion to `docs/roadmap.md` (the
weekly/hour-level plan this breaks down further) and `docs/devlog.md` (the record of what
actually happened, which wins if the two disagree).

**Status as of 2026-09-06**: submission got the green light to proceed; funds have not landed
yet. Dates below assume a start of Monday 2026-09-07 — shift the whole table if the funded clock
starts on a different day. The point of this doc isn't the exact dates, it's the sequencing and
the one-commit-per-day discipline: each day below should produce at least one real, working
commit, not a placeholder.

Each day = roughly one committable unit of work. Buffer days exist on purpose (Sundays, plus one
mid-week catch-up per week) — if a day's task slips, absorb it there rather than skipping ahead
and leaving gaps in the commit history.

## Week 1 (Sep 7 – Sep 13) — D2 hardening close-out, D1 wallet foundations start

| Day | Date | Task | Commit produces |
|---|---|---|---|
| 1 | ~~Mon 09-07~~ Sun 09-06 | (done) Decide `rotate_admin`: implement it, or write the explicit rationale for leaving it out of a 30-day PoC (`docs/authorization.md`) | Code or doc change closing the open "future work" note |
| 2 | Tue 09-08 | `contracts/provenance/src/test.rs`: add `set_registrar` revocation case, `revoke`-on-already-`Revoked`, TTL-extension-at-threshold | New passing Rust tests |
| 3 | Wed 09-09 | Security self-review checklist in `docs/evidence.md` (acceptance-criterion → artifact mapping, explicit what-was/wasn't-checked list) | Doc update |
| 4 | Thu 09-10 | `scripts/setup-accounts.ts`: SEP-1 discovery against `testanchor.stellar.org` | Working script (discovery half) |
| 5 | Fri 09-11 | `scripts/setup-accounts.ts`: trustline establishment for `acuris`/`partner` Testnet accounts, verified live via Horizon | Working script (trustline half) + evidence entry |
| 6 | Sat 09-12 | Wire Stellar Wallets Kit into `web/`: wallet-select UI, connect flow only (no signing yet) | New component + passing connect flow |
| 7 | Sun 09-13 | Buffer/catch-up. Reconcile `docs/roadmap.md` against actual Week 1 outcome | Roadmap doc update |

## Week 2 (Sep 14 – Sep 20) — D1 wallet + anchor-asset integration

| Day | Date | Task | Commit produces |
|---|---|---|---|
| 8 | Mon 09-14 | Swap settlement signing from the ephemeral in-browser keypair to Wallets Kit (happy path) | Real wallet-signed Testnet transaction |
| 9 | Tue 09-15 | Handle the Wallets Kit user-reject/cancel path in the UI | Handled rejection state (feeds Day 17) |
| 10 | Wed 09-16 | Wire the testanchor SRT asset code + trustline check into the settlement UI | UI reflects asset requirement |
| 11 | Thu 09-17 | Swap settlement payment legs from native XLM to the SRT asset; verify live | Real SRT-denominated Testnet transaction |
| 12 | Fri 09-18 | `scripts/settle.ts`: standalone CLI (revenue event in, unsigned XDR out), matching `register-provenance.ts`'s pattern | Working CLI script |
| 13 | Sat 09-19 | Update UI copy/labels for the wallet+asset flow (remove ephemeral-keypair messaging, show connected wallet address) | UI copy pass |
| 14 | Sun 09-20 | Buffer/catch-up. Full happy-path re-verification: connect → sign → SRT payment → independent Horizon confirm | Fix commits for anything found |

## Week 3 (Sep 21 – Sep 27) — D1 negative cases, integration

| Day | Date | Task | Commit produces |
|---|---|---|---|
| 15 | Mon 09-21 | Missing-trustline negative case, run live, real rejection captured | New failure-case panel entry + evidence |
| 16 | Tue 09-22 | Duplicate `event_id` replay negative case, run live | New failure-case panel entry + evidence |
| 17 | Wed 09-23 | User-rejected-signature negative case via Wallets Kit decline (uses Day 9's handling) | New failure-case panel entry + evidence |
| 18 | Thu 09-24 | `docs/evidence.md`: full D1 section — all 8/8 negative cases, transaction hashes, explorer links | Doc update |
| 19 | Fri 09-25 | Full integration pass: both flows exercised together in one session, not in isolation | Bugfixes for any cross-flow issues found |
| 20 | Sat 09-26 | If on schedule: SEP-10 web-auth stretch item, or start the Soroban splitter contract prototype for the SCF story. If not: absorb slippage here instead | Stretch feature, or explicit "skipped, here's why" note |
| 21 | Sun 09-27 | Buffer/catch-up. Re-run full test suite, confirm and record the new total count | `docs/devlog.md` entry |

## Week 4 (Sep 28 – Oct 6) — verification, demo, submission package

| Day | Date | Task | Commit produces |
|---|---|---|---|
| 22 | Mon 09-28 | Privacy sweep of the *entire* git history (not just current tree) for PHI/key material | Remediation commit, or a recorded clean-scan result |
| 23 | Tue 09-29 | `docs/runbook.md` clean-room re-verification: wipe and rebuild from scratch, fix any drift | Runbook fixes |
| 24 | Wed 09-30 | Demo video: script + capture both flows plus one live failure case | Raw footage / script committed if text-based |
| 25 | Thu 10-01 | Demo video: edit, publish, link into README and `docs/evidence.md` | README/doc update with video link |
| 26 | Fri 10-02 | Final documentation pass: reconcile `architecture.md`, `evidence.md`, `roadmap.md`, `devlog.md` against actual end state | Doc reconciliation commit |
| 27 | Sat 10-03 | Full negative-case matrix (both flows) re-confirmed live in one clean pass; capture screenshots/logs | Evidence update |
| 28 | Sun 10-04 | Package completion evidence for Ambassador Chapter Lead review (single index linking everything) | New evidence-index doc |
| 29 | Mon 10-05 | Buffer: final self-audit against the SOW's acceptance criteria, close any gaps found | Gap-closing commits |
| 30 | Tue 10-06 | Submission day: final commit, tag the release, send to Ambassador Chapter Lead | Tagged release |

## How to keep this current

Update the date column (not the sequence) if the actual start date shifts. If a day's real outcome
diverges from the plan, note it in `docs/devlog.md` on the day it happens — this doc is the
forward-looking plan, the devlog is the record of what was true.
