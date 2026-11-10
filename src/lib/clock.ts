/**
 * The clock seam (C22). Direct `new Date()` / `Date.now()` is banned in
 * src/server/** and src/features/ ** /actions.ts by an ESLint rule that exempts
 * only this file, so the slot engine, hold expiry, OTP windows and KPI ranges
 * are all unit-testable without sleeping or stubbing global Date.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Test double: returns the same instant no matter how much real time passes. */
export class FixedClock implements Clock {
  private instant: Date;

  constructor(instant: Date | string) {
    this.instant = typeof instant === "string" ? new Date(instant) : new Date(instant.getTime());
  }

  now(): Date {
    // A fresh object each call, so a caller mutating the result cannot
    // retroactively change what the clock reports.
    return new Date(this.instant.getTime());
  }

  /** Move the clock forward (or back, with a negative value) by milliseconds. */
  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }

  set(instant: Date | string): void {
    this.instant = typeof instant === "string" ? new Date(instant) : new Date(instant.getTime());
  }
}

let ambientClock: Clock = systemClock;

/** Default clock for call sites that do not take one explicitly. */
export function getClock(): Clock {
  return ambientClock;
}

/** Test-only override; pair every call with `resetClock()` in a teardown. */
export function setClock(clock: Clock): void {
  ambientClock = clock;
}

export function resetClock(): void {
  ambientClock = systemClock;
}
