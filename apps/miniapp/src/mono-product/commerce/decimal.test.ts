import { describe, expect, it } from "vitest";
import {
  addCommerceDecimal, compareCommerceDecimal, multiplyCommerceDecimal,
  normalizeCommerceAmount, readCommerceDecimal, validateCommerceAmount,
} from "./decimal";
import type { AmountTerms } from "./types";

describe("commerce decimal input", () => {
  it("canonicalizes unsigned UI decimals without losing significant digits", () => {
    const cases = [
      [" 0001,2300 ", "1.23"],
      [".5", "0.5"],
      ["10.", "10"],
      ["00.000", "0"],
      ["9007199254740993.000000000000000001", "9007199254740993.000000000000000001"],
    ] as const;
    for (const [raw, expected] of cases) expect(normalizeCommerceAmount(raw)).toBe(expected);
  });

  it("rejects signed, exponent and malformed UI amounts", () => {
    for (const raw of ["1e3", "-1", "+1", "1,234.56", "1..2", "1 2", "1\n2", ".", "", "NaN"]) {
      expect(normalizeCommerceAmount(raw)).toBeNull();
    }
  });

  it("bounds UI input before trimming or removing zeros", () => {
    expect(normalizeCommerceAmount(" ".repeat(128) + "1")).toBeNull();
    expect(normalizeCommerceAmount("0".repeat(129))).toBeNull();
    expect(normalizeCommerceAmount(" ".repeat(127) + "1")).toBe("1");
    expect(normalizeCommerceAmount("1".repeat(128))).toBe("1".repeat(128));
  });

  it("canonicalizes strict provider strings with exact decimal digits", () => {
    expect(readCommerceDecimal("001.2300")).toBe("1.23");
    expect(readCommerceDecimal("0.000")).toBe("0");
    expect(readCommerceDecimal("9007199254740993.000000000000000001"))
      .toBe("9007199254740993.000000000000000001");
    expect(readCommerceDecimal("1".repeat(128))).toBe("1".repeat(128));
  });

  it("refuses coercion and UI shorthand in provider decimals", () => {
    for (const value of [".5", "1.", "1,2", " 1", "1 ", "1\n", "1\r", "1\u2028", "+1", "-1", "1e3", "1..2", "", "1".repeat(129), 1, null, undefined]) {
      expect(readCommerceDecimal(value)).toBeNull();
    }
  });
});

describe("commerce amount terms", () => {
  it("accepts normalized amounts at inclusive limits and ignores redundant fractional zeros", () => {
    const terms: AmountTerms = { decimals: 2, minimum: "10", maximum: "100" };
    expect(validateCommerceAmount(" 0010,000 ", terms)).toEqual({ valid: true, amount: "10" });
    expect(validateCommerceAmount("00100.0000", terms)).toEqual({ valid: true, amount: "100" });
    expect(validateCommerceAmount("50.23000", terms)).toEqual({ valid: true, amount: "50.23" });
    expect(validateCommerceAmount("1.000", { decimals: 0, minimum: "0", maximum: "10" }))
      .toEqual({ valid: true, amount: "1" });
  });

  it("refuses zero and nondecimal amounts before checking minimums", () => {
    for (const raw of ["0", "00,000", "-1", "1e2", ""]) {
      expect(validateCommerceAmount(raw, { decimals: 2, minimum: "10", maximum: "100" }))
        .toEqual({ valid: false, issue: { code: "invalid-amount" } });
    }
  });

  it("reports excess meaningful precision before either limit", () => {
    for (const raw of ["10.001", "0.001", "100.001"]) {
      expect(validateCommerceAmount(raw, { decimals: 2, minimum: "10", maximum: "100" }))
        .toEqual({ valid: false, issue: { code: "precision" } });
    }
  });

  it("enforces exact lower and upper limits without rounding an atomic unit away", () => {
    const terms: AmountTerms = {
      decimals: 18,
      minimum: "9007199254740993.000000000000000001",
      maximum: "9007199254740993.000000000000000002",
    };
    expect(validateCommerceAmount("9007199254740993", terms))
      .toEqual({ valid: false, issue: { code: "below-minimum" } });
    expect(validateCommerceAmount("9007199254740993.000000000000000003", terms))
      .toEqual({ valid: false, issue: { code: "above-maximum" } });
    expect(validateCommerceAmount("9007199254740993.000000000000000002", terms))
      .toEqual({ valid: true, amount: "9007199254740993.000000000000000002" });
  });

  it("makes unknown, inconsistent and overprecise terms unavailable", () => {
    const cases: unknown[] = [
      null,
      undefined,
      { decimals: 2, minimum: null, maximum: "100" },
      { decimals: -1, minimum: "0", maximum: "100" },
      { decimals: 37, minimum: "0", maximum: "100" },
      { decimals: 1.5, minimum: "0", maximum: "100" },
      { decimals: NaN, minimum: "0", maximum: "100" },
      { decimals: 2, minimum: "0", maximum: "0" },
      { decimals: 2, minimum: "11", maximum: "10" },
      { decimals: 2, minimum: "10.001", maximum: "100" },
      { decimals: 2, minimum: "0", maximum: "100.001" },
      { decimals: 2, minimum: "10\n", maximum: "100" },
      { decimals: 2, minimum: "0", maximum: "1e3" },
    ];
    for (const terms of cases) {
      expect(validateCommerceAmount("0", terms as AmountTerms))
        .toEqual({ valid: false, issue: { code: "unavailable" } });
    }
  });
});

describe("exact commerce arithmetic", () => {
  it("orders amounts beyond floating point precision by their last atomic unit", () => {
    const cases = [
      ["9007199254740993.000000000000000002", "9007199254740993.000000000000000001", 1],
      ["9007199254740993.000000000000000001", "9007199254740993.000000000000000002", -1],
      ["2", "10", -1],
      ["0.1", "0.09", 1],
      ["0", "0", 0],
    ] as const;
    for (const [left, right, expected] of cases) expect(compareCommerceDecimal(left, right)).toBe(expected);
  });

  it("adds source fees exactly across fractional carries", () => {
    expect(addCommerceDecimal("9007199254740993.999999", "0.000001")).toBe("9007199254740994");
    expect(addCommerceDecimal("499.000001", "1")).toBe("500.000001");
    expect(addCommerceDecimal("0.1", "0.2")).toBe("0.3");
    expect(addCommerceDecimal("0", "0")).toBe("0");
  });

  it("multiplies exactly then floors to the requested output precision", () => {
    expect(multiplyCommerceDecimal("9007199254740993", "0.000000000000000001", 18))
      .toBe("0.009007199254740993");
    expect(multiplyCommerceDecimal("1.234567", "0.1", 6)).toBe("0.123456");
    expect(multiplyCommerceDecimal("0.009", "0.009", 4)).toBe("0");
    expect(multiplyCommerceDecimal("2.99", "1", 0)).toBe("2");
    expect(multiplyCommerceDecimal("2", "3", 36)).toBe("6");
    expect(multiplyCommerceDecimal("0", "2", 18)).toBe("0");
  });

  it("fails invalid arithmetic arguments with RangeError", () => {
    const invalid: unknown[] = ["1e2", "-1", "1.0", "01", "1\n", "1".repeat(129), null, undefined, 1];
    for (const input of invalid) {
      const value = input as string;
      expect(() => compareCommerceDecimal(value, "1")).toThrow(RangeError);
      expect(() => compareCommerceDecimal("1", value)).toThrow(RangeError);
      expect(() => addCommerceDecimal(value, "1")).toThrow(RangeError);
      expect(() => addCommerceDecimal("1", value)).toThrow(RangeError);
      expect(() => multiplyCommerceDecimal(value, "1", 6)).toThrow(RangeError);
      expect(() => multiplyCommerceDecimal("1", value, 6)).toThrow(RangeError);
    }
    for (const precision of [-1, 37, 1.5, NaN, Infinity]) {
      expect(() => multiplyCommerceDecimal("1", "1", precision)).toThrow(RangeError);
    }
  });
});
