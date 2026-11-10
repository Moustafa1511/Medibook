import { describe, expect, it } from "vitest";

import { computeOccupiedSlotKeys } from "@/server/slots/availability";

function iso(keys: readonly Date[]): string[] {
  return keys.map((k) => k.toISOString());
}

describe("computeOccupiedSlotKeys", () => {
  it("returns one key per slotIntervalMin step when duration is an exact multiple", () => {
    const start = new Date("2026-01-05T08:00:00.000Z");
    expect(iso(computeOccupiedSlotKeys(start, 30, 0, 15))).toEqual([
      "2026-01-05T08:00:00.000Z",
      "2026-01-05T08:15:00.000Z",
    ]);
  });

  it("rounds up (ceil) and locks the trailing partial interval fully when duration is not a multiple of slotIntervalMin", () => {
    const start = new Date("2026-01-05T08:00:00.000Z");
    // ceil(50 / 15) = 4, not 3 — the trailing 5 minutes still locks the whole 4th interval.
    const keys = computeOccupiedSlotKeys(start, 50, 0, 15);
    expect(keys).toHaveLength(4);
    expect(iso(keys)).toEqual([
      "2026-01-05T08:00:00.000Z",
      "2026-01-05T08:15:00.000Z",
      "2026-01-05T08:30:00.000Z",
      "2026-01-05T08:45:00.000Z",
    ]);
  });

  it("folds bufferMin into the occupied span before the ceil", () => {
    const start = new Date("2026-01-05T08:00:00.000Z");
    const withoutBuffer = computeOccupiedSlotKeys(start, 30, 0, 15); // ceil(30/15) = 2
    const withBuffer = computeOccupiedSlotKeys(start, 30, 15, 15); // ceil(45/15) = 3
    expect(withoutBuffer).toHaveLength(2);
    expect(withBuffer).toHaveLength(3);
    expect(iso(withBuffer).at(-1)).toBe("2026-01-05T08:30:00.000Z");
  });

  it("returns a single key for a duration shorter than one slotIntervalMin", () => {
    const start = new Date("2026-01-05T08:00:00.000Z");
    expect(computeOccupiedSlotKeys(start, 5, 0, 15)).toHaveLength(1);
  });
});
