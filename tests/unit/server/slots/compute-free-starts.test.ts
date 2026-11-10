import { describe, expect, it } from "vitest";

import { computeFreeStarts } from "@/server/slots/availability";
import type { Shift, SlotEngineService, SlotEngineSettings } from "@/server/slots/types";

const BERLIN = "Europe/Berlin";
const FAR_PAST_NOW = new Date("2026-01-01T00:00:00.000Z");

function settings(overrides: Partial<SlotEngineSettings> = {}): SlotEngineSettings {
  return {
    timeZone: BERLIN,
    slotIntervalMin: 15,
    bufferMin: 0,
    minLeadTimeMin: 0,
    maxAdvanceDays: 60,
    ...overrides,
  };
}

const service30: SlotEngineService = { id: "svc-30", durationMin: 30 };

function displayTimes(slots: ReturnType<typeof computeFreeStarts>): string[] {
  return slots.map((s) => s.displayLocal);
}

describe("computeFreeStarts", () => {
  it("steps slotIntervalMin through a normal single-shift weekday", () => {
    const shifts: Shift[] = [{ openMinute: 9 * 60, closeMinute: 18 * 60 }]; // 09:00-18:00
    const slots = computeFreeStarts({
      dateLocal: "2026-01-05", // a Monday
      shifts,
      service: service30,
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    // Last bookable 30-minute start is 17:30 (17:30 + 30 = 18:00, exactly closing).
    expect(slots).toHaveLength(35);
    expect(slots[0]?.displayLocal).toBe("09:00");
    expect(slots.at(-1)?.displayLocal).toBe("17:30");
    expect(displayTimes(slots)).not.toContain("18:00");
  });

  it("produces two separate bands for a السبت split shift, excluding the midday gap entirely", () => {
    const shifts: Shift[] = [
      { openMinute: 9 * 60, closeMinute: 13 * 60 }, // 09:00-13:00
      { openMinute: 16 * 60, closeMinute: 20 * 60 }, // 16:00-20:00
    ];
    const slots = computeFreeStarts({
      dateLocal: "2026-01-10", // a Saturday
      shifts,
      service: service30,
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    expect(slots).toHaveLength(30); // 15 per band
    expect(slots[0]?.displayLocal).toBe("09:00");
    expect(slots[14]?.displayLocal).toBe("12:30"); // last of band 1 (12:30 + 30 = 13:00)
    expect(slots[15]?.displayLocal).toBe("16:00"); // first of band 2, no gap-filling
    expect(slots.at(-1)?.displayLocal).toBe("19:30");

    for (const time of displayTimes(slots)) {
      expect(time <= "12:30" || time >= "16:00").toBe(true);
    }
  });

  it("returns nothing when there are no shifts for the day (e.g. a closed weekday)", () => {
    const slots = computeFreeStarts({
      dateLocal: "2026-01-11", // a Sunday
      shifts: [],
      service: service30,
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });
    expect(slots).toEqual([]);
  });

  it("excludes a candidate near closing whose service duration would run past the shift end", () => {
    const shifts: Shift[] = [{ openMinute: 9 * 60, closeMinute: 10 * 60 }]; // 09:00-10:00, one hour
    const slots = computeFreeStarts({
      dateLocal: "2026-01-05",
      shifts,
      service: { id: "svc-60", durationMin: 60 }, // exactly fills the shift once
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });
    // 09:00 fits exactly (09:00-10:00); 09:15 would end at 10:15, past closing.
    expect(slots).toHaveLength(1);
    expect(slots[0]?.displayLocal).toBe("09:00");
  });

  it("rounds a duration that is not a multiple of slotIntervalMin up (ceil) and locks the whole trailing interval", () => {
    const shifts: Shift[] = [{ openMinute: 9 * 60, closeMinute: 11 * 60 }]; // 09:00-11:00
    const service50: SlotEngineService = { id: "svc-50", durationMin: 50 }; // ceil(50/15) = 4 keys

    // Berlin is CET (+01:00) in January: 09:00 local = 08:00Z.
    const occupiedAt0900Z = new Date("2026-01-05T09:00:00.000Z").getTime(); // = 10:00 local

    const slots = computeFreeStarts({
      dateLocal: "2026-01-05",
      shifts,
      service: service50,
      occupiedKeys: new Set([occupiedAt0900Z]),
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    // 09:15's exact 50-minute span is 09:15-10:05, which never literally reaches 10:00 —
    // but its 4th, ceil-rounded 15-minute grid cell (09:45-10:00's slot key, i.e. this
    // key) still locks it, same as 09:30 and 09:45 (whose 3rd/2nd keys land on 10:00) and
    // 10:00 itself (whose own 1st key IS 10:00). Only 09:00, whose 4 keys stop at 09:45,
    // is unaffected.
    expect(displayTimes(slots)).toEqual(["09:00"]);
  });

  it("drops exactly the candidates whose occupied-slot keys overlap an existing booking, and no others", () => {
    const shifts: Shift[] = [{ openMinute: 9 * 60, closeMinute: 18 * 60 }];
    // A 30-minute booking starting at 10:00 local (09:00Z in January) occupies the
    // 09:00Z and 09:15Z slot keys.
    const occupied = new Set([
      new Date("2026-01-05T09:00:00.000Z").getTime(),
      new Date("2026-01-05T09:15:00.000Z").getTime(),
    ]);

    const slots = computeFreeStarts({
      dateLocal: "2026-01-05",
      shifts,
      service: service30,
      occupiedKeys: occupied,
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    const times = displayTimes(slots);
    // 09:45, 10:00 and 10:15 each have at least one occupied key and are excluded; their
    // immediate neighbours 09:30 and 10:30 do not overlap and survive.
    expect(times).toContain("09:30");
    expect(times).not.toContain("09:45");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:15");
    expect(times).toContain("10:30");
  });

  it("filters out candidates earlier than now + minLeadTimeMin", () => {
    const shifts: Shift[] = [{ openMinute: 9 * 60, closeMinute: 18 * 60 }];
    // 08:00Z = 09:00 local (CET, +01:00); +60min lead => horizon is 09:00Z = 10:00 local.
    const now = new Date("2026-01-05T08:00:00.000Z");

    const slots = computeFreeStarts({
      dateLocal: "2026-01-05",
      shifts,
      service: service30,
      occupiedKeys: new Set(),
      settings: settings({ minLeadTimeMin: 60 }),
      now,
    });

    const times = displayTimes(slots);
    expect(times).not.toContain("09:45");
    expect(times[0]).toBe("10:00"); // the horizon instant itself is inclusive (>=)
  });

  it("de-duplicates candidates that resolve to the same UTC instant (e.g. two overlapping shift rows)", () => {
    const shifts: Shift[] = [
      { openMinute: 9 * 60, closeMinute: 9 * 60 + 30 },
      { openMinute: 9 * 60, closeMinute: 9 * 60 + 30 }, // duplicate row — insurance, not a real config
    ];
    const slots = computeFreeStarts({
      dateLocal: "2026-01-05",
      shifts,
      service: { id: "svc-15", durationMin: 15 },
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    expect(displayTimes(slots)).toEqual(["09:00", "09:15"]);
  });

  it("drops a spring-forward nonexistent wall time instead of returning its colliding instant", () => {
    const shifts: Shift[] = [{ openMinute: 0, closeMinute: 4 * 60 }]; // 00:00-04:00
    const slots = computeFreeStarts({
      dateLocal: "2026-03-29", // spring-forward: local 02:00-02:59 does not exist
      shifts,
      service: { id: "svc-15", durationMin: 15 },
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    const times = displayTimes(slots);
    expect(slots).toHaveLength(12); // 16 raw candidates, 4 inside the gap dropped
    expect(times).toContain("01:45");
    expect(times).toContain("03:00");
    expect(times).not.toContain("02:00");
    expect(times).not.toContain("02:15");
    expect(times).not.toContain("02:30");
    expect(times).not.toContain("02:45");
  });

  it("resolves a fall-back ambiguous wall time to the earlier instant, with no candidates dropped", () => {
    const shifts: Shift[] = [{ openMinute: 0, closeMinute: 4 * 60 }]; // 00:00-04:00
    const slots = computeFreeStarts({
      dateLocal: "2026-10-25", // fall-back: local 02:00-02:59 occurs twice
      shifts,
      service: { id: "svc-15", durationMin: 15 },
      occupiedKeys: new Set(),
      settings: settings(),
      now: FAR_PAST_NOW,
    });

    expect(slots).toHaveLength(16); // nothing dropped — ambiguity is resolved, not a gap
    const twoOClock = slots.find((s) => s.displayLocal === "02:00");
    expect(twoOClock?.startUtc.toISOString()).toBe("2026-10-25T00:00:00.000Z"); // earlier, not 01:00Z
  });
});
