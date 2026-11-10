import { describe, expect, it } from "vitest";

import { resolveWallTime } from "@/server/slots/availability";

const BERLIN = "Europe/Berlin";

describe("resolveWallTime", () => {
  it("resolves a normal, unambiguous wall time to its UTC instant", () => {
    // 09:30 local in June (CEST, +02:00) is 07:30 UTC.
    expect(resolveWallTime("2026-06-15", 9 * 60 + 30, BERLIN)).toEqual({
      kind: "ok",
      instant: new Date("2026-06-15T07:30:00.000Z"),
    });
  });

  describe("spring-forward (2026-03-29, Europe/Berlin — local 02:00-02:59 does not exist)", () => {
    it("resolves the wall time just before the gap normally (01:30, pre-transition +01:00)", () => {
      expect(resolveWallTime("2026-03-29", 90, BERLIN)).toEqual({
        kind: "ok",
        instant: new Date("2026-03-29T00:30:00.000Z"),
      });
    });

    it("resolves the first wall time after the gap normally (03:00, post-transition +02:00)", () => {
      expect(resolveWallTime("2026-03-29", 180, BERLIN)).toEqual({
        kind: "ok",
        instant: new Date("2026-03-29T01:00:00.000Z"),
      });
    });

    it("reports a nonexistent wall time inside the gap (02:30) instead of the colliding instant", () => {
      // tests/unit/lib/dates.test.ts pins that date-fns-tz silently collides this with
      // 01:30's real instant (2026-03-29T00:30:00.000Z) — resolveWallTime must detect
      // that round-trip mismatch and report `nonexistent`, never that colliding instant.
      expect(resolveWallTime("2026-03-29", 150, BERLIN)).toEqual({ kind: "nonexistent" });
    });
  });

  describe("fall-back (2026-10-25, Europe/Berlin — local 02:00-02:59 occurs twice)", () => {
    it("resolves the wall time just before the ambiguous window normally (01:30, CEST +02:00)", () => {
      expect(resolveWallTime("2026-10-25", 90, BERLIN)).toEqual({
        kind: "ok",
        instant: new Date("2026-10-24T23:30:00.000Z"),
      });
    });

    it("resolves the first wall time after the ambiguous window normally (03:00, CET +01:00)", () => {
      expect(resolveWallTime("2026-10-25", 180, BERLIN)).toEqual({
        kind: "ok",
        instant: new Date("2026-10-25T02:00:00.000Z"),
      });
    });

    it("resolves an ambiguous wall time (02:00) to the EARLIER instant, not date-fns-tz's default later one", () => {
      // date-fns-tz's fromZonedTime deterministically returns the SECOND (CET, +01:00)
      // occurrence, 2026-10-25T01:00:00.000Z (pinned in tests/unit/lib/dates.test.ts). C6's
      // policy requires the FIRST (CEST, +02:00) occurrence instead.
      const result = resolveWallTime("2026-10-25", 120, BERLIN);
      expect(result).toEqual({ kind: "ok", instant: new Date("2026-10-25T00:00:00.000Z") });
      if (result.kind === "ok") {
        expect(result.instant.getTime()).not.toBe(new Date("2026-10-25T01:00:00.000Z").getTime());
      }
    });
  });
});
