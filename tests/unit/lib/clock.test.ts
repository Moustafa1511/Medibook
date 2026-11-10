import { afterEach, describe, expect, it } from "vitest";

import { FixedClock, getClock, resetClock, setClock, systemClock } from "@/lib/clock";

afterEach(() => {
  resetClock();
});

describe("FixedClock", () => {
  it("returns the same instant across real elapsed time", async () => {
    const clock = new FixedClock("2026-03-29T01:30:00.000Z");
    const first = clock.now();
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = clock.now();

    expect(second.getTime()).toBe(first.getTime());
    expect(first.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("hands out copies, so a mutating caller cannot change the clock", () => {
    const clock = new FixedClock("2026-01-01T00:00:00.000Z");
    const borrowed = clock.now();
    borrowed.setFullYear(1999);

    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("advances by an explicit amount", () => {
    const clock = new FixedClock("2026-01-01T00:00:00.000Z");
    clock.advance(10 * 60_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:10:00.000Z");
  });
});

describe("systemClock", () => {
  it("reports approximately the real time", () => {
    const before = Date.now();
    const reported = systemClock.now().getTime();
    expect(Math.abs(reported - before)).toBeLessThan(50);
  });
});

describe("ambient clock", () => {
  it("defaults to the system clock and can be overridden for a test", () => {
    expect(getClock()).toBe(systemClock);

    const fixed = new FixedClock("2026-06-01T09:00:00.000Z");
    setClock(fixed);
    expect(getClock().now().toISOString()).toBe("2026-06-01T09:00:00.000Z");

    resetClock();
    expect(getClock()).toBe(systemClock);
  });
});
