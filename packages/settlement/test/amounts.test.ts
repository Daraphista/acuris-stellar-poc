import { test } from "node:test";
import assert from "node:assert/strict";

import { AmountError } from "../src/errors.js";
import { parseDecimalToMinor, formatMinorAsDecimal } from "../src/amounts.js";

test("parseDecimalToMinor / formatMinorAsDecimal: known round-trip values", () => {
  const cases: Array<[input: string, minor: bigint, formatted: string]> = [
    ["0.0000001", 1n, "0.0000001"],
    ["1", 10000000n, "1.0000000"],
    ["1.5", 15000000n, "1.5000000"],
    ["9999.9999999", 99999999999n, "9999.9999999"],
    ["0", 0n, "0.0000000"],
  ];
  for (const [input, minor, formatted] of cases) {
    assert.equal(parseDecimalToMinor(input), minor, `parse(${input})`);
    assert.equal(formatMinorAsDecimal(minor), formatted, `format(${minor})`);
  }
});

test("parseDecimalToMinor: rejects malformed input", () => {
  const bad = ["1.00000001", "-1", "1e5", "abc", "", "1.2.3", " 1", "1 ", "+1", "01", "1."];
  for (const input of bad) {
    assert.throws(() => parseDecimalToMinor(input), AmountError, `should reject ${JSON.stringify(input)}`);
  }
});

test("parseDecimalToMinor: no float contamination in addition", () => {
  // 0.1 + 0.2 !== 0.3 in IEEE-754 double arithmetic — this only holds if parsing goes through
  // BigInt end to end rather than `Number(input) * 10 ** decimals`.
  const sum = parseDecimalToMinor("0.1") + parseDecimalToMinor("0.2");
  assert.equal(sum, parseDecimalToMinor("0.3"));
});

test("formatMinorAsDecimal: rejects negative amounts", () => {
  assert.throws(() => formatMinorAsDecimal(-1n), AmountError);
});
