/**
 * Decimal-string <-> minor-unit (stroop) conversion. Every Stellar classic-ledger asset amount —
 * native XLM or any issued asset — uses the same fixed-point convention: up to 7 fractional
 * digits. This has nothing to do with a specific asset's "decimals" metadata (Stellar classic
 * assets don't have any); it's a property of the amount encoding itself.
 *
 * Deliberately never routes a value through `Number` for arithmetic — only string parsing and
 * BigInt math — so e.g. parseDecimalToMinor("0.1") + parseDecimalToMinor("0.2") is exactly
 * parseDecimalToMinor("0.3"), which is not true of naive `Number(input) * 10 ** decimals`.
 */
import { AmountError } from "./errors.js";

export const STELLAR_AMOUNT_DECIMALS = 7;

const regexCache = new Map<number, RegExp>();

function decimalRegex(decimals: number): RegExp {
  let re = regexCache.get(decimals);
  if (!re) {
    // Integer part: "0" or a non-zero digit followed by digits (no leading zeros).
    // Optional fractional part: a literal '.' then 1..decimals digits (no trailing dot alone,
    // no more than `decimals` places). No sign, no exponent, no whitespace.
    re = new RegExp(`^(0|[1-9][0-9]*)(?:\\.([0-9]{1,${decimals}}))?$`);
    regexCache.set(decimals, re);
  }
  return re;
}

/**
 * Parses a canonical non-negative decimal string into an integer count of minor units.
 * Rejects anything not already in minimal, unsigned, at-most-`decimals`-fractional-digit form —
 * this is a strict parser, not a lenient one, because it feeds a real Stellar payment amount.
 */
export function parseDecimalToMinor(
  input: string,
  decimals: number = STELLAR_AMOUNT_DECIMALS,
): bigint {
  if (decimals < 1) {
    throw new AmountError(`decimals must be >= 1 (got ${decimals})`);
  }
  const match = decimalRegex(decimals).exec(input);
  if (!match) {
    throw new AmountError(
      `not a valid amount: expected a non-negative decimal with at most ${decimals} ` +
        `fractional digits, no sign, no exponent, no leading zeros (e.g. "10.5"): ` +
        `${JSON.stringify(input)}`,
    );
  }
  const [, integerPart, fractionPart] = match;
  const paddedFraction = (fractionPart ?? "").padEnd(decimals, "0");
  return BigInt(integerPart) * 10n ** BigInt(decimals) + BigInt(paddedFraction);
}

/** Inverse of parseDecimalToMinor. Always emits exactly `decimals` fractional digits — the
 *  fixed-width form Operation.payment's `amount` field expects. */
export function formatMinorAsDecimal(
  minor: bigint,
  decimals: number = STELLAR_AMOUNT_DECIMALS,
): string {
  if (decimals < 1) {
    throw new AmountError(`decimals must be >= 1 (got ${decimals})`);
  }
  if (minor < 0n) {
    throw new AmountError(`amount cannot be negative: ${minor}`);
  }
  const scale = 10n ** BigInt(decimals);
  const integerPart = minor / scale;
  const fractionPart = (minor % scale).toString().padStart(decimals, "0");
  return `${integerPart}.${fractionPart}`;
}
