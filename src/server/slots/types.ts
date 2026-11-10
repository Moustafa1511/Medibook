/**
 * Shared types for the slot availability engine (Section 6, C17/A9). Kept
 * dependency-free (no Prisma, no Clock) so both `availability.ts` and
 * `hold-expiry.ts` — and the Phase 5 booking transaction that reuses
 * `computeOccupiedSlotKeys` — can import from here without a cycle.
 */

/** A clinic-local working-hour shift, in minutes-from-midnight (C5's `WorkingHour` convention). */
export interface Shift {
  readonly openMinute: number;
  readonly closeMinute: number;
}

/**
 * The result of resolving a clinic-local wall time to a UTC instant (C6's
 * "WORDING CORRECTION"). A wall time is either:
 * - `"ok"`: it exists and resolves unambiguously, or it is the ambiguous
 *   fall-back case, already resolved to the policy-correct EARLIER instant.
 * - `"nonexistent"`: it falls inside a spring-forward gap and must be dropped.
 */
export type ResolvedWallTime = { kind: "ok"; instant: Date } | { kind: "nonexistent" };

/** One surviving bookable candidate, as returned by `getAvailableSlots`. */
export interface AvailableSlot {
  /** The UTC instant `Appointment.startsAtUtc` / `AppointmentSlot.slotStartUtc[0]` would use. */
  readonly startUtc: Date;
  /** `startUtc + service.durationMin` (buffer is occupancy-only; it is never part of the visible appointment window). */
  readonly endUtc: Date;
  /** Every `AppointmentSlot.slotStartUtc` key this candidate would occupy if booked (duration + buffer). */
  readonly occupiedKeys: readonly Date[];
  /** Clinic-local "HH:mm" for display, e.g. in the wizard's time picker. */
  readonly displayLocal: string;
}

/** Why a given calendar day is disabled in `getAvailableDays`' result, for UI copy. */
export type UnavailableDayReason =
  "PAST" | "BEYOND_WINDOW" | "CLOSED_DATE" | "NO_WORKING_HOURS" | "LEAD_TIME" | "FULLY_BOOKED";

/** One day of a month's availability grid, as returned by `getAvailableDays`. */
export type DayAvailability =
  | { readonly dateLocal: string; readonly available: true }
  | {
      readonly dateLocal: string;
      readonly available: false;
      readonly reason: UnavailableDayReason;
    };

/**
 * The minimal shape `computeFreeStarts` / `getFreeSlotsInTx` need from
 * `ClinicSettings` — a structural subset, not the Prisma row itself, so pure
 * functions in this module stay Prisma-free and trivially testable with plain
 * object literals.
 */
export interface SlotEngineSettings {
  readonly timeZone: string;
  readonly slotIntervalMin: number;
  readonly bufferMin: number;
  readonly minLeadTimeMin: number;
  readonly maxAdvanceDays: number;
}

/** The minimal shape of a `Service` the engine needs. */
export interface SlotEngineService {
  readonly id: string;
  readonly durationMin: number;
}

/**
 * Error codes the slot engine itself can throw (a subset of C12's `ErrorCode`
 * union — only the ones this module is responsible for raising). `errors.ts`
 * (C12's shared `ErrorCode` union) does not exist yet at the repo root, so this
 * stays a self-contained, structurally-compatible subset: any later
 * `src/lib/errors.ts` union that includes these same literal strings can widen
 * `SlotEngineErrorCode` to it without a call-site change.
 */
export type SlotEngineErrorCode =
  "VALIDATION_ERROR" | "SLOT_UNAVAILABLE" | "CLOSED_DAY" | "OUTSIDE_BOOKING_WINDOW";

/**
 * Typed engine error (Section 6's "Engine functions ... throw a typed engine
 * error; the `defineAction` wrapper (C12) converts that into `ActionResult<T>`").
 * Never thrown across the client boundary directly — a Server Action catches it.
 */
export class SlotEngineError extends Error {
  readonly code: SlotEngineErrorCode;

  constructor(code: SlotEngineErrorCode, message: string) {
    super(message);
    this.name = "SlotEngineError";
    this.code = code;
  }
}
