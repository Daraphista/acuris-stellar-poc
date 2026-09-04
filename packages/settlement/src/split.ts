/**
 * The 50/50 split engine. No SDK dependency — pure integer arithmetic over minor units
 * (stroops), so it's testable without touching a network. See docs/architecture.md for how
 * this feeds the transaction builder in transaction.ts.
 */
import { SplitError } from "./errors.js";

export type SplitRole = "acuris" | "partner";

/**
 * Where the odd minor unit goes when gross is not evenly divisible by 2. Fixed, not a
 * parameter: a configurable remainder rule is a rule nobody reviewing the published event JSON
 * could verify. If this ever changes, update it here — the arithmetic below is written to make
 * that a one-line change.
 */
export const REMAINDER_RECIPIENT: SplitRole = "partner";

export interface SplitLeg {
  role: SplitRole;
  destination: string;
  /** integer minor units (stroops); always > 0 for a valid split */
  amountMinor: bigint;
}

export interface Split {
  grossMinor: bigint;
  /** fixed order: [acuris, partner] */
  legs: readonly [SplitLeg, SplitLeg];
  /** 0n or 1n — the odd unit, already folded into REMAINDER_RECIPIENT's leg above */
  remainderMinor: bigint;
}

const MAX_U64 = 18446744073709551615n;

// StrKey ed25519 public key: 'G' + 55 base32 (RFC 4648, no padding) characters, 56 total.
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

function assertLooksLikeStellarPublicKey(value: string, label: string): void {
  if (!STELLAR_PUBLIC_KEY_RE.test(value)) {
    throw new SplitError(
      `${label} does not look like a Stellar public key (expected 'G' + 55 base32 chars): ` +
        JSON.stringify(value),
    );
  }
}

/** Accepts the same string|number|bigint shape docs/canonicalization.md uses for minor-unit
 *  integers elsewhere in this repo (see RevenueEvent.grossAmountMinor). */
function toBigIntMinor(value: bigint | string | number): bigint {
  let n: bigint;
  if (typeof value === "bigint") {
    n = value;
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new SplitError(`grossMinor number must be a safe integer, got ${value}`);
    }
    n = BigInt(value);
  } else {
    if (!/^(0|[1-9][0-9]*)$/.test(value)) {
      throw new SplitError(`grossMinor string must be minimal-form non-negative digits: ${value}`);
    }
    n = BigInt(value);
  }
  if (n < 0n || n > MAX_U64) {
    throw new SplitError(`grossMinor out of range [0, 2^64-1]: ${n}`);
  }
  return n;
}

/**
 * Splits `grossMinor` 50/50 in integer minor units between the fixed acuris/partner
 * destinations. Throws SplitError if gross < 2: Stellar rejects a payment operation with a
 * non-positive amount (PAYMENT_MALFORMED), so a two-leg split cannot express a gross of 0 or 1
 * at all — that has to fail here, with a readable message, not at Horizon.
 */
export function splitFiftyFifty(args: {
  grossMinor: bigint | string | number;
  acurisDestination: string;
  partnerDestination: string;
}): Split {
  const grossMinor = toBigIntMinor(args.grossMinor);
  assertLooksLikeStellarPublicKey(args.acurisDestination, "acurisDestination");
  assertLooksLikeStellarPublicKey(args.partnerDestination, "partnerDestination");

  if (grossMinor < 2n) {
    throw new SplitError(
      `gross amount must be at least 2 minor units to express as two positive-amount payment ` +
        `operations (got ${grossMinor})`,
    );
  }

  const base = grossMinor / 2n;
  const remainderMinor = grossMinor % 2n; // 0n or 1n, since we divided by 2n

  const legs: [SplitLeg, SplitLeg] = [
    { role: "acuris", destination: args.acurisDestination, amountMinor: base },
    // REMAINDER_RECIPIENT === "partner": the odd unit lands here.
    { role: "partner", destination: args.partnerDestination, amountMinor: base + remainderMinor },
  ];

  if (legs[0].amountMinor + legs[1].amountMinor !== grossMinor) {
    // Unreachable given the arithmetic above — kept as a hard invariant, not a lint nicety.
    // This is the property the whole deliverable rests on; if it ever fires, stop everything.
    throw new SplitError("internal error: split legs do not sum to gross");
  }

  return { grossMinor, legs, remainderMinor };
}
