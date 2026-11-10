/**
 * The ONLY module in the repo permitted to import `date-fns-tz` (C6). Every UTC <->
 * clinic-local conversion elsewhere goes through one of these exports, so a time-zone
 * bug has exactly one place to be fixed — enforced the same way C16/C22 pin `env.ts` and
 * `clock.ts` as their modules' single call sites.
 *
 * Kept pure on purpose: every helper here takes the time zone as a parameter (in
 * practice, `ClinicSettings.timeZone`) and never reads `process.env` or a `Clock` itself,
 * so this module stays synchronous and trivially unit-testable.
 *
 * ## DST, as `date-fns-tz` actually resolves it (Europe/Berlin, verified in
 * tests/unit/lib/dates.test.ts — read this before touching Section 6's slot grid)
 *
 * - Spring-forward gap (e.g. 2026-03-29, local 02:00-02:59 does not exist — clocks jump
 *   straight to 03:00): `fromZonedTime` does NOT throw. It keeps applying the
 *   PRE-transition (standard/winter) offset to every nominal minute "inside" the gap, so
 *   e.g. local 02:30 resolves to the same UTC instant as local 01:30 — a genuine
 *   collision between a real wall time and a nonexistent one. `buildClinicInstant` is a
 *   faithful wrapper over this, not a fix for it: Section 6's `resolveWallTime` (built in
 *   Phase 4, src/server/slots/availability.ts) is the place that detects the collision
 *   (by round-tripping the result through `formatInTimeZone` and comparing wall times)
 *   and drops the candidate.
 * - Fall-back ambiguity (e.g. 2026-10-25, local 02:00-02:59 occurs twice): `fromZonedTime`
 *   deterministically resolves to the SECOND occurrence (the POST-transition, standard/CET
 *   offset) — not the first. C6 requires preferring the FIRST (earlier UTC, DST/CEST)
 *   instant for the slot grid, so a caller that needs that policy must compute both
 *   candidate instants itself (again, Phase 4's `resolveWallTime`) rather than trust this
 *   single-instant helper alone.
 *
 * This module does not implement that disambiguation — it only exposes a faithful,
 * documented wrapper over the library's real per-point behaviour, which is what Section 6
 * is built on top of.
 */

import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export { formatInTimeZone, fromZonedTime, toZonedTime };

const DATE_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDateLocal(dateLocal: string): void {
  if (!DATE_LOCAL_PATTERN.test(dateLocal)) {
    throw new Error(
      `dates.buildClinicInstant: "${dateLocal}" is not a "YYYY-MM-DD" clinic-local date string.`,
    );
  }
}

function assertMinutesFromMidnight(minutesFromMidnight: number): void {
  if (
    !Number.isInteger(minutesFromMidnight) ||
    minutesFromMidnight < 0 ||
    minutesFromMidnight > 1439
  ) {
    throw new Error(
      "dates.buildClinicInstant: expected minutesFromMidnight to be an integer between 0 " +
        `and 1439 (C5's WorkingHour convention), got ${minutesFromMidnight}.`,
    );
  }
}

/**
 * Build a UTC instant from a clinic-local wall-clock time: a `"YYYY-MM-DD"` date string
 * plus a whole number of minutes since local midnight (C5's `WorkingHour.openMinute` /
 * `closeMinute` convention). This is the single conversion Section 6.1's slot-grid
 * construction performs for each candidate start, BEFORE any DST-ambiguity handling (see
 * the module doc above).
 */
export function buildClinicInstant(
  dateLocal: string,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  assertDateLocal(dateLocal);
  assertMinutesFromMidnight(minutesFromMidnight);
  const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const mm = String(minutesFromMidnight % 60).padStart(2, "0");
  return fromZonedTime(`${dateLocal}T${hh}:${mm}:00`, timeZone);
}

/**
 * The clinic-local `"YYYY-MM-DD"` calendar date a UTC instant falls on — Section 6's
 * `localDate(now, tz)` (e.g. the "today" boundary for `getAvailableDays`'s past/future
 * classification and the booking window). Never derive this by slicing an ISO UTC
 * string: the clinic's local date and the UTC calendar date disagree for part of every
 * day (Berlin is always ahead of UTC), which is exactly the bug this helper exists to
 * prevent.
 */
export function clinicLocalDate(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
}
