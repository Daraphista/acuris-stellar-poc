/**
 * Walks a supersession chain backwards from its head.
 *
 * The registry is append-only: a correction is registered as a *new* record carrying
 * `supersedes = <prior batch_hash>`, and the prior record transitions to `Superseded` rather than
 * being edited or removed. So the full history of a batch is recoverable by following
 * `supersedes` from the newest record until one has none — which is what this does.
 *
 * Nothing here is derived or inferred: every node returned is a record the contract handed back.
 */
import { getByHash, type ProvenanceRecord } from "./provenance.js";

/** Guards against a malformed cycle on chain costing the page an infinite loop. The real chains
 *  are 1–3 links; anything approaching this bound means something is wrong, not deep. */
const MAX_CHAIN_LENGTH = 32;

export interface ProvenanceChain {
  /** Oldest first, so index 0 is the original registration and the last entry is the head. */
  records: ProvenanceRecord[];
  /** True when the walk stopped early rather than reaching an origin record. */
  truncated: boolean;
}

/**
 * Builds the chain ending at `head`. `head` is included, so a record with no `supersedes`
 * returns a single-element chain — which is the correct representation of a batch that has
 * never been corrected, not an empty result.
 */
export async function walkSupersessionChain(head: ProvenanceRecord): Promise<ProvenanceChain> {
  const records: ProvenanceRecord[] = [head];
  const seen = new Set<string>([head.batchHashHex]);

  let cursor = head;
  while (cursor.supersedesHex) {
    if (records.length >= MAX_CHAIN_LENGTH) {
      return { records: records.reverse(), truncated: true };
    }
    if (seen.has(cursor.supersedesHex)) {
      // A cycle can't happen through the contract's own rules, but reading it as data rather
      // than trusting it keeps a corrupt chain from hanging the page.
      return { records: records.reverse(), truncated: true };
    }

    const prior = await getByHash(cursor.supersedesHex);
    seen.add(prior.batchHashHex);
    records.push(prior);
    cursor = prior;
  }

  return { records: records.reverse(), truncated: false };
}

/** How many `supersedes` links the chain contains — one fewer than its record count. */
export function supersessionLinkCount(chain: ProvenanceChain): number {
  return Math.max(0, chain.records.length - 1);
}
