import { describe, expect, it } from "vitest";

import { formatMoney, majorToMinor, minorToMajor, sumMinor } from "@/lib/money";

describe("formatMoney", () => {
  it("formats a 2-digit currency (EUR)", () => {
    expect(formatMoney(5000, "EUR", "en-GB")).toBe("€50.00");
  });

  it(
    "formats a 0-digit currency (JPY) with no decimal point — proves the exponent is read " +
      "from Intl, not hardcoded as 100",
    () => {
      // JPY's minor unit IS the major unit (maximumFractionDigits === 0), so 500 minor units
      // is ¥500, not ¥5.00. A hardcoded `/ 100` would wrongly produce "¥5".
      expect(formatMoney(500, "JPY", "ja-JP")).toBe("￥500");
    },
  );

  it(
    "formats a 3-digit currency (JOD) — proves the exponent generalizes past the common " +
      "2-digit case",
    () => {
      // 5500 minor fils is 5.500 dinars. A hardcoded `/ 100` would wrongly produce "JOD 55.00".
      // Intl inserts a non-breaking space (U+00A0) between the ISO code and the amount here —
      // that is correct typographic output for this locale, so the test asserts the literal
      // character rather than normalizing whitespace away (per the module's own doc comment).
      expect(formatMoney(5500, "JOD", "en-US")).toBe("JOD 5.500");
    },
  );

  it("throws a clear error for a non-integer minor-unit amount", () => {
    expect(() => formatMoney(1050.5, "EUR", "en-GB")).toThrow(/integer minor-unit amount/);
  });
});

describe("majorToMinor / minorToMajor", () => {
  it("round-trips a 2-digit currency", () => {
    expect(majorToMinor(50, "EUR", "en-GB")).toBe(5000);
    expect(minorToMajor(5000, "EUR", "en-GB")).toBe(50);
  });

  it("round-trips a 0-digit currency", () => {
    expect(majorToMinor(500, "JPY", "ja-JP")).toBe(500);
    expect(minorToMajor(500, "JPY", "ja-JP")).toBe(500);
  });

  it("round-trips a 3-digit currency", () => {
    expect(majorToMinor(5.5, "JOD", "en-US")).toBe(5500);
    expect(minorToMajor(5500, "JOD", "en-US")).toBe(5.5);
  });

  it("rounds away binary floating-point noise instead of truncating it", () => {
    // 19.9 * 100 is 1989.9999999999998 in IEEE 754 double arithmetic; a naive
    // `Math.floor`/truncating conversion would silently undercharge by one minor unit.
    expect(majorToMinor(19.9, "EUR", "en-GB")).toBe(1990);
  });

  it("minorToMajor throws a clear error for a non-integer minor-unit amount", () => {
    expect(() => minorToMajor(10.5, "EUR", "en-GB")).toThrow(/integer minor-unit amount/);
  });
});

describe("sumMinor", () => {
  it("adds minor units as integers", () => {
    expect(sumMinor([1000, 2500, 500])).toBe(4000);
  });

  it("returns 0 for an empty list", () => {
    expect(sumMinor([])).toBe(0);
  });

  it("throws a clear error if any amount is not an integer", () => {
    expect(() => sumMinor([1000, 10.5, 500])).toThrow(/integer minor-unit amount/);
  });
});
