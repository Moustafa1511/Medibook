import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { formatInTimeZone as formatInTimeZoneDirect } from "date-fns-tz";
import { describe, expect, it } from "vitest";

import {
  buildClinicInstant,
  clinicLocalDate,
  formatInTimeZone,
  fromZonedTime,
  toZonedTime,
} from "@/lib/dates";

const BERLIN = "Europe/Berlin";

describe("re-exports", () => {
  it("re-exports the real date-fns-tz functions by reference, not a reimplementation", async () => {
    const direct = await import("date-fns-tz");
    expect(fromZonedTime).toBe(direct.fromZonedTime);
    expect(toZonedTime).toBe(direct.toZonedTime);
    expect(formatInTimeZone).toBe(direct.formatInTimeZone);
  });
});

describe("buildClinicInstant", () => {
  it("converts a normal clinic-local wall time to its UTC instant", () => {
    // 09:30 local in June (CEST, UTC+2) is 07:30 UTC.
    expect(buildClinicInstant("2026-06-15", 9 * 60 + 30, BERLIN).toISOString()).toBe(
      "2026-06-15T07:30:00.000Z",
    );
  });

  describe("DST spring-forward (2026-03-29, Europe/Berlin — local 02:00-02:59 does not exist)", () => {
    it("resolves a time just before the gap normally", () => {
      expect(buildClinicInstant("2026-03-29", 90, BERLIN).toISOString()).toBe(
        "2026-03-29T00:30:00.000Z",
      );
    });

    it("resolves the first instant after the gap normally (new, +02:00 offset)", () => {
      expect(buildClinicInstant("2026-03-29", 180, BERLIN).toISOString()).toBe(
        "2026-03-29T01:00:00.000Z",
      );
    });

    it(
      "collides a nonexistent wall time with a real, earlier one — the actual behaviour " +
        "Section 6's resolveWallTime (Phase 4) must detect and drop, not an error thrown here",
      () => {
        const realInstant = buildClinicInstant("2026-03-29", 90, BERLIN); // 01:30, real
        const nonexistentInstant = buildClinicInstant("2026-03-29", 150, BERLIN); // 02:30, skipped

        // Both resolve to the SAME UTC instant: fromZonedTime keeps applying the
        // pre-transition (+01:00) offset to every nominal minute inside the gap.
        expect(nonexistentInstant.toISOString()).toBe("2026-03-29T00:30:00.000Z");
        expect(nonexistentInstant.getTime()).toBe(realInstant.getTime());

        // Formatting it back in the zone shows 01:30, never the 02:30 that was asked for —
        // the round-trip mismatch Phase 4 uses to detect the gap.
        expect(formatInTimeZone(nonexistentInstant, BERLIN, "HH:mm")).toBe("01:30");
      },
    );
  });

  describe("DST fall-back (2026-10-25, Europe/Berlin — local 02:00-02:59 occurs twice)", () => {
    it("resolves a time just before the ambiguous window normally", () => {
      expect(buildClinicInstant("2026-10-25", 90, BERLIN).toISOString()).toBe(
        "2026-10-24T23:30:00.000Z",
      );
    });

    it("resolves the first instant after the ambiguous window normally (+01:00 offset)", () => {
      expect(buildClinicInstant("2026-10-25", 180, BERLIN).toISOString()).toBe(
        "2026-10-25T02:00:00.000Z",
      );
    });

    it(
      "resolves an ambiguous wall time deterministically to the SECOND (post-transition, " +
        "CET) occurrence — not the first, which is why Phase 4 cannot rely on this helper " +
        "alone for C6's earlier-instant policy",
      () => {
        const resolved = buildClinicInstant("2026-10-25", 120, BERLIN); // 02:00, ambiguous
        expect(resolved.toISOString()).toBe("2026-10-25T01:00:00.000Z");

        const firstRealOccurrence = new Date("2026-10-25T00:00:00.000Z"); // CEST, +02:00
        const secondRealOccurrence = new Date("2026-10-25T01:00:00.000Z"); // CET, +01:00

        // Both real, distinct instants display as the same local wall-clock string —
        // this is the actual ambiguity, one hour apart.
        expect(formatInTimeZoneDirect(firstRealOccurrence, BERLIN, "HH:mm")).toBe("02:00");
        expect(formatInTimeZoneDirect(secondRealOccurrence, BERLIN, "HH:mm")).toBe("02:00");

        expect(resolved.getTime()).toBe(secondRealOccurrence.getTime());
        expect(resolved.getTime()).not.toBe(firstRealOccurrence.getTime());
      },
    );
  });

  describe("validation", () => {
    it("rejects a dateLocal string that is not YYYY-MM-DD", () => {
      expect(() => buildClinicInstant("2026-3-5", 0, BERLIN)).toThrow(/YYYY-MM-DD/);
      expect(() => buildClinicInstant("not-a-date", 0, BERLIN)).toThrow(/YYYY-MM-DD/);
    });

    it("rejects an out-of-range or non-integer minutesFromMidnight", () => {
      expect(() => buildClinicInstant("2026-06-15", -1, BERLIN)).toThrow(/minutesFromMidnight/);
      expect(() => buildClinicInstant("2026-06-15", 1440, BERLIN)).toThrow(/minutesFromMidnight/);
      expect(() => buildClinicInstant("2026-06-15", 90.5, BERLIN)).toThrow(/minutesFromMidnight/);
    });
  });
});

describe("clinicLocalDate", () => {
  it("returns the clinic-local calendar date for a UTC instant", () => {
    expect(clinicLocalDate(new Date("2026-06-15T07:30:00.000Z"), BERLIN)).toBe("2026-06-15");
  });

  it(
    "disagrees with the UTC calendar date near local midnight — the exact bug this " +
      "helper exists to prevent (never slice the ISO string instead)",
    () => {
      // 23:30 UTC on the 15th is 01:30 local on the 16th (CEST, UTC+2).
      expect(clinicLocalDate(new Date("2026-06-15T23:30:00.000Z"), BERLIN)).toBe("2026-06-16");
    },
  );
});

describe("module boundary (C6)", () => {
  it("is the only file under src that imports date-fns-tz directly", () => {
    const srcDir = path.resolve(import.meta.dirname, "../../../src");
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (fullPath === path.resolve(import.meta.dirname, "../../../src/lib/dates.ts")) continue;

        const contents = readFileSync(fullPath, "utf8");
        if (/from\s+["']date-fns-tz["']/.test(contents)) {
          offenders.push(path.relative(srcDir, fullPath));
        }
      }
    };

    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
