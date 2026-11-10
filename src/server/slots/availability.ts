/**
 * Slot availability engine (Section 6, C17/A9). Grid construction and the
 * availability queries live here; the lazy/cron hold-expiry sweep lives in
 * the sibling `hold-expiry.ts` and is imported by this module (not the other
 * way around).
 *
 * Three layers, cheapest-to-test first:
 * - `resolveWallTime` / `computeOccupiedSlotKeys` / `computeFreeStarts` are
 *   pure, synchronous, DB-free. `computeFreeStarts` is reused verbatim by
 *   `getAvailableDays` (given a pre-fetched month's occupied set — no
 *   per-day query, C23) and by `getFreeSlotsInTx`.
 * - `getFreeSlotsInTx` does the DB reads for one day and is itself reused —
 *   inside the CALLER'S OWN transaction — by Phase 5's `createBooking` and
 *   `rescheduleAppointment` for their mandatory re-check (6.4/6.5).
 * - `getAvailableDays` / `getAvailableSlots` are the public, Clock-taking
 *   entry points Server Actions call (C22).
 *
 * All lead-time/window/past comparisons happen on UTC instants (invariant 3,
 * C6); clinic-local wall-clock strings are used only to construct a
 * candidate, via `@/lib/dates`, the one module allowed to import
 * `date-fns-tz`.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { buildClinicInstant, clinicLocalDate, formatInTimeZone } from "@/lib/dates";
import type { Clock } from "@/lib/clock";
import { db } from "@/server/db";

import { sweepExpiredHolds } from "./hold-expiry";
import {
  SlotEngineError,
  type AvailableSlot,
  type DayAvailability,
  type ResolvedWallTime,
  type Shift,
  type SlotEngineService,
  type SlotEngineSettings,
  type UnavailableDayReason,
} from "./types";

export type { AvailableSlot, DayAvailability, ResolvedWallTime, UnavailableDayReason };
export { SlotEngineError };

type QueryClient = PrismaClient | Prisma.TransactionClient;

const ONE_HOUR_MS = 60 * 60 * 1000;

// --------------------------------------------------------------- calendar helpers
// Pure "YYYY-MM-DD" calendar-string arithmetic. These never represent a real
// instant — they are anchored to UTC purely as a bookkeeping trick for
// unambiguous y/m/d math (`setUTCDate` never observes a DST transition) — so
// they are a different thing from the clinic-local-wall-time -> UTC-instant
// conversions below, which all go through `@/lib/dates`.

function addDays(dateLocal: string, days: number): string {
  const anchor = new Date(`${dateLocal}T00:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

function weekdayOfDateLocal(dateLocal: string): number {
  // 0 = Sunday .. 6 = Saturday (C5's WorkingHour.weekday convention). A
  // calendar date's weekday does not depend on the clinic's time zone, so
  // this needs no zone-aware conversion.
  return new Date(`${dateLocal}T00:00:00Z`).getUTCDay();
}

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const match = YEAR_MONTH_PATTERN.exec(yearMonth);
  if (!match) {
    throw new SlotEngineError(
      "VALIDATION_ERROR",
      `"${yearMonth}" is not a "YYYY-MM" month string.`,
    );
  }
  const [, yearStr, monthStr] = match;
  if (yearStr === undefined || monthStr === undefined) {
    throw new Error("unreachable: capture groups are guaranteed by YEAR_MONTH_PATTERN");
  }
  return { year: Number(yearStr), month: Number(monthStr) };
}

function firstOfNextMonth(yearMonth: string): string {
  const { year, month } = parseYearMonth(yearMonth);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
}

// -------------------------------------------------------------- 6.1: resolveWallTime

function wallTimeKey(dateLocal: string, minutesFromMidnight: number): string {
  const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const mm = String(minutesFromMidnight % 60).padStart(2, "0");
  return `${dateLocal}T${hh}:${mm}`;
}

/**
 * Resolve a clinic-local wall time (a `"YYYY-MM-DD"` date plus
 * minutes-from-midnight) to a UTC instant, per C6's wording-corrected policy:
 *
 * - NONEXISTENT (spring-forward gap, e.g. 02:30 on 2026-03-29 Europe/Berlin):
 *   `date-fns-tz`'s `fromZonedTime` (wrapped by `buildClinicInstant`) does
 *   NOT throw — it silently keeps applying the pre-transition offset, so the
 *   nonexistent wall time collides with a real, earlier one (dates.ts's
 *   module doc; pinned by `tests/unit/lib/dates.test.ts`). We detect this by
 *   round-tripping: format the candidate instant back in the zone, and if it
 *   does not display as the wall time we asked for, that wall time never
 *   existed — report `{ kind: "nonexistent" }` so the caller drops it.
 * - AMBIGUOUS (fall-back, e.g. 02:00 on 2026-10-25 occurs twice): the
 *   round-trip above succeeds (there is no gap, just an overlap), but
 *   `fromZonedTime` deterministically returns the LATER of the two real
 *   instants. C6 requires the EARLIER one (the numerically smaller value, the
 *   one with the LARGER UTC offset). We probe one hour before the candidate:
 *   if THAT instant also formats back to the same wall time, the candidate
 *   was ambiguous and the probe is the correct, earlier answer.
 * - Otherwise the wall time is unambiguous: return the candidate as-is.
 */
export function resolveWallTime(
  dateLocal: string,
  minutesFromMidnight: number,
  timeZone: string,
): ResolvedWallTime {
  const candidate = buildClinicInstant(dateLocal, minutesFromMidnight, timeZone);
  const requestedWall = wallTimeKey(dateLocal, minutesFromMidnight);

  if (formatInTimeZone(candidate, timeZone, "yyyy-MM-dd'T'HH:mm") !== requestedWall) {
    return { kind: "nonexistent" };
  }

  const probe = new Date(candidate.getTime() - ONE_HOUR_MS);
  if (formatInTimeZone(probe, timeZone, "yyyy-MM-dd'T'HH:mm") === requestedWall) {
    return { kind: "ok", instant: probe };
  }

  return { kind: "ok", instant: candidate };
}

// --------------------------------------------------------- 6.1: computeOccupiedSlotKeys

/**
 * The UTC `AppointmentSlot.slotStartUtc` keys a booking starting at `startUtc`
 * would occupy: `ceil((durationMin + bufferMin) / slotIntervalMin)`
 * consecutive `slotIntervalMin`-spaced instants (6.1's buffer-inclusive
 * generalization of C5's row-count note — see PLAN.md 6's "Contract
 * Challenges"). Pure and exported so Phase 5's booking transaction inserts
 * exactly these same keys (the task's explicit requirement) and so
 * `computeFreeStarts` below can reuse it for the occupancy check.
 */
export function computeOccupiedSlotKeys(
  startUtc: Date,
  durationMin: number,
  bufferMin: number,
  slotIntervalMin: number,
): Date[] {
  const durationSlots = Math.ceil((durationMin + bufferMin) / slotIntervalMin);
  const keys: Date[] = [];
  for (let i = 0; i < durationSlots; i += 1) {
    keys.push(new Date(startUtc.getTime() + i * slotIntervalMin * 60_000));
  }
  return keys;
}

// ------------------------------------------------------------- 6.3: computeFreeStarts

export interface ComputeFreeStartsParams {
  readonly dateLocal: string;
  readonly shifts: readonly Shift[];
  readonly service: SlotEngineService;
  /** Epoch-ms `slotStartUtc` values already occupied that day (pre-fetched by the caller). */
  readonly occupiedKeys: ReadonlySet<number>;
  readonly settings: SlotEngineSettings;
  readonly now: Date;
}

/**
 * Pure, synchronous candidate generation for one clinic-local date — the
 * shared core behind both `getAvailableDays` (fed a pre-fetched month-wide
 * occupied set, no DB access here) and `getFreeSlotsInTx` (6.3). Order
 * follows the task's lettered steps c-j exactly:
 *   c. step `slotIntervalMin` through EACH shift independently (so a split
 *      shift's midday gap is never iterated at all, not merely excluded);
 *   d. resolve each candidate wall time, dropping nonexistent ones;
 *   e. the loop bound itself drops a candidate whose duration+buffer would
 *      run past ITS shift's close;
 *   f. drop candidates earlier than `now + minLeadTimeMin`;
 *   g./h. compute each survivor's occupied slot keys and drop any that
 *      intersect the already-occupied set;
 *   i. de-duplicate on the resulting UTC instant (insurance against two
 *      shifts, or two DST-adjacent wall times, resolving to one instant);
 *   j. return survivors with both the UTC instant and the clinic-local
 *      display string, sorted by start time.
 */
export function computeFreeStarts(params: ComputeFreeStartsParams): AvailableSlot[] {
  const { dateLocal, shifts, service, occupiedKeys, settings, now } = params;
  const totalMin = service.durationMin + settings.bufferMin;
  const leadHorizonMs = now.getTime() + settings.minLeadTimeMin * 60_000;

  // c, d, e.
  const resolved: Date[] = [];
  for (const shift of shifts) {
    for (
      let cursor = shift.openMinute;
      cursor + totalMin <= shift.closeMinute;
      cursor += settings.slotIntervalMin
    ) {
      const wall = resolveWallTime(dateLocal, cursor, settings.timeZone);
      if (wall.kind === "ok") {
        resolved.push(wall.instant);
      }
    }
  }

  // f.
  const afterLeadTime = resolved.filter((instant) => instant.getTime() >= leadHorizonMs);

  // g, h, i.
  const survivors: AvailableSlot[] = [];
  const seenInstants = new Set<number>();
  for (const startUtc of afterLeadTime) {
    const startMs = startUtc.getTime();
    if (seenInstants.has(startMs)) continue;

    const occupiedSlotKeys = computeOccupiedSlotKeys(
      startUtc,
      service.durationMin,
      settings.bufferMin,
      settings.slotIntervalMin,
    );
    if (occupiedSlotKeys.some((key) => occupiedKeys.has(key.getTime()))) continue;

    seenInstants.add(startMs);
    survivors.push({
      startUtc,
      endUtc: new Date(startMs + service.durationMin * 60_000),
      occupiedKeys: occupiedSlotKeys,
      displayLocal: formatInTimeZone(startUtc, settings.timeZone, "HH:mm"),
    });
  }

  // j.
  survivors.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return survivors;
}

// ----------------------------------------------------------------- shared DB reads
// Invariant 5 (6.1): slotIntervalMin, working hours and closed dates are read
// FRESH per call, never cached across requests — all three can change. (A
// per-REQUEST React.cache() wrapper so one request's getAvailableDays +
// getAvailableSlots share one read is Section 6.7's optimization; it belongs
// in the features/booking query layer that calls this module, not here.)

async function loadSettings(client: QueryClient): Promise<SlotEngineSettings> {
  const row = await client.clinicSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    throw new Error(
      "ClinicSettings singleton row is missing — the clinic is not configured (seed data expected).",
    );
  }
  return {
    timeZone: row.timeZone,
    slotIntervalMin: row.slotIntervalMin,
    bufferMin: row.bufferMin,
    minLeadTimeMin: row.minLeadTimeMin,
    maxAdvanceDays: row.maxAdvanceDays,
  };
}

async function loadActiveService(
  client: QueryClient,
  serviceId: string,
): Promise<SlotEngineService | null> {
  const row = await client.service.findUnique({ where: { id: serviceId } });
  if (!row || !row.isActive) {
    return null;
  }
  return { id: row.id, durationMin: row.durationMin };
}

async function loadActiveServiceOrThrow(
  client: QueryClient,
  serviceId: string,
): Promise<SlotEngineService> {
  const service = await loadActiveService(client, serviceId);
  if (!service) {
    throw new SlotEngineError("VALIDATION_ERROR", "That service is not available for booking.");
  }
  return service;
}

async function loadWorkingHoursByWeekday(
  client: QueryClient,
): Promise<ReadonlyMap<number, Shift[]>> {
  const rows = await client.workingHour.findMany({
    orderBy: [{ weekday: "asc" }, { openMinute: "asc" }],
  });
  const byWeekday = new Map<number, Shift[]>();
  for (const row of rows) {
    const shifts = byWeekday.get(row.weekday) ?? [];
    shifts.push({ openMinute: row.openMinute, closeMinute: row.closeMinute });
    byWeekday.set(row.weekday, shifts);
  }
  return byWeekday;
}

async function loadClosedDatesInRange(
  client: QueryClient,
  startInclusiveLocal: string,
  endExclusiveLocal: string,
): Promise<ReadonlySet<string>> {
  const rows = await client.closedDate.findMany({
    where: { date: { gte: startInclusiveLocal, lt: endExclusiveLocal } },
    select: { date: true },
  });
  return new Set(rows.map((row) => row.date));
}

async function isClosedDate(client: QueryClient, dateLocal: string): Promise<boolean> {
  const row = await client.closedDate.findUnique({ where: { date: dateLocal } });
  return row !== null;
}

// ------------------------------------------------------------- 6.3: getFreeSlotsInTx

/**
 * The DB-reading core behind `getAvailableSlots`, reused — inside the
 * CALLER'S OWN transaction — by Phase 5's `createBooking` and
 * `rescheduleAppointment` for their mandatory availability re-check (6.4/6.5).
 * `now` is passed in rather than read from a `Clock` here because every
 * caller already has one `now` for its whole transaction and must reuse it,
 * not take a second, possibly-later reading mid-transaction.
 *
 * One range query over `AppointmentSlot` (served by its `slotStartUtc` unique
 * index) plus the settings/hours/closed-date reads above — no N+1 (C23).
 */
export async function getFreeSlotsInTx(
  client: Prisma.TransactionClient,
  dateLocal: string,
  serviceId: string,
  now: Date,
): Promise<AvailableSlot[]> {
  const [settings, service] = await Promise.all([
    loadSettings(client),
    loadActiveServiceOrThrow(client, serviceId),
  ]);

  const weekday = weekdayOfDateLocal(dateLocal);
  const [hoursByWeekday, closed] = await Promise.all([
    loadWorkingHoursByWeekday(client),
    isClosedDate(client, dateLocal),
  ]);

  const shifts = hoursByWeekday.get(weekday) ?? [];
  if (shifts.length === 0 || closed) {
    return [];
  }

  const dayStartUtc = buildClinicInstant(dateLocal, 0, settings.timeZone);
  const dayEndUtc = buildClinicInstant(addDays(dateLocal, 1), 0, settings.timeZone);

  const occupiedRows = await client.appointmentSlot.findMany({
    where: { slotStartUtc: { gte: dayStartUtc, lt: dayEndUtc } },
    select: { slotStartUtc: true },
  });
  const occupiedKeys = new Set(occupiedRows.map((row) => row.slotStartUtc.getTime()));

  return computeFreeStarts({ dateLocal, shifts, service, occupiedKeys, settings, now });
}

// -------------------------------------------------------------- 6.3: getAvailableSlots

export interface GetAvailableSlotsParams {
  readonly dateLocal: string;
  readonly serviceId: string;
  readonly clock: Clock;
}

/**
 * The thin, publicly-exported entry point (6.3): opens the transaction,
 * sweeps expired holds first — INSIDE this same transaction, so the slots it
 * frees are immediately visible to the occupancy read that follows, with no
 * commit-then-reread race against a concurrent booking — then delegates to
 * `getFreeSlotsInTx`.
 */
export async function getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailableSlot[]> {
  const { dateLocal, serviceId, clock } = params;
  return db.$transaction(async (tx) => {
    await sweepExpiredHolds({ clock, tx });
    const now = clock.now();
    return getFreeSlotsInTx(tx, dateLocal, serviceId, now);
  });
}

// --------------------------------------------------------------- 6.2: getAvailableDays

export interface GetAvailableDaysParams {
  /** `"YYYY-MM"`. */
  readonly yearMonth: string;
  readonly serviceId: string;
  readonly clock: Clock;
}

/**
 * Feeds the calendar's disabled-days matcher (6.2). Returns every day in the
 * month with its availability and, when unavailable, a reason the UI can
 * explain itself with.
 *
 * PERFORMANCE (C23): exactly ONE range query over `AppointmentSlot` for the
 * whole month, grouped in memory by clinic-local date — never a query per
 * day. The "fully booked" check for each remaining candidate day reuses that
 * same in-memory map via `computeFreeStarts`, so it costs no second query.
 */
export async function getAvailableDays(params: GetAvailableDaysParams): Promise<DayAvailability[]> {
  const { yearMonth, serviceId, clock } = params;
  const now = clock.now();

  const [settings, service] = await Promise.all([
    loadSettings(db),
    loadActiveService(db, serviceId),
  ]);
  if (!service) {
    return [];
  }

  const monthStartLocal = `${yearMonth}-01`;
  const monthEndLocalExclusive = firstOfNextMonth(yearMonth);

  const leadHorizonMs = now.getTime() + settings.minLeadTimeMin * 60_000;
  const todayLocal = clinicLocalDate(now, settings.timeZone);
  const maxAdvanceDateLocal = addDays(todayLocal, settings.maxAdvanceDays);

  const [hoursByWeekday, closedDateSet] = await Promise.all([
    loadWorkingHoursByWeekday(db),
    loadClosedDatesInRange(db, monthStartLocal, monthEndLocalExclusive),
  ]);

  // Lazy sweep (C9.5): no enclosing transaction here, so this opens its own
  // short one (see hold-expiry.ts's TRANSACTION CHOICE comment) before the
  // occupancy read below, so a hold that just expired is already freed.
  await sweepExpiredHolds({ clock });

  const monthStartUtc = buildClinicInstant(monthStartLocal, 0, settings.timeZone);
  const monthEndUtc = buildClinicInstant(monthEndLocalExclusive, 0, settings.timeZone);
  const occupiedRows = await db.appointmentSlot.findMany({
    where: { slotStartUtc: { gte: monthStartUtc, lt: monthEndUtc } },
    select: { slotStartUtc: true },
  });

  const occupiedByDate = new Map<string, Set<number>>();
  for (const row of occupiedRows) {
    const dateKey = clinicLocalDate(row.slotStartUtc, settings.timeZone);
    const set = occupiedByDate.get(dateKey) ?? new Set<number>();
    set.add(row.slotStartUtc.getTime());
    occupiedByDate.set(dateKey, set);
  }

  const days: DayAvailability[] = [];
  for (
    let cursorLocal = monthStartLocal;
    cursorLocal < monthEndLocalExclusive;
    cursorLocal = addDays(cursorLocal, 1)
  ) {
    const shifts = hoursByWeekday.get(weekdayOfDateLocal(cursorLocal)) ?? [];

    const reason = ((): UnavailableDayReason | null => {
      if (cursorLocal < todayLocal) return "PAST";
      if (cursorLocal > maxAdvanceDateLocal) return "BEYOND_WINDOW";
      if (closedDateSet.has(cursorLocal)) return "CLOSED_DATE";
      if (shifts.length === 0) return "NO_WORKING_HOURS";

      const lastShift = shifts.at(-1);
      if (!lastShift) {
        throw new Error("unreachable: shifts.length > 0 was just checked above");
      }
      const lastCloseUtc = buildClinicInstant(
        cursorLocal,
        lastShift.closeMinute,
        settings.timeZone,
      );
      if (lastCloseUtc.getTime() <= leadHorizonMs) return "LEAD_TIME"; // whole-day fast path

      const occupiedKeys = occupiedByDate.get(cursorLocal) ?? new Set<number>();
      const free = computeFreeStarts({
        dateLocal: cursorLocal,
        shifts,
        service,
        occupiedKeys,
        settings,
        now,
      });
      return free.length === 0 ? "FULLY_BOOKED" : null;
    })();

    days.push(
      reason === null
        ? { dateLocal: cursorLocal, available: true }
        : { dateLocal: cursorLocal, available: false, reason },
    );
  }

  return days;
}
