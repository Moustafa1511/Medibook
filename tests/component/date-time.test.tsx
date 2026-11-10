import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type * as DatesModule from "@/lib/dates";

const formatInTimeZoneSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof DatesModule>();
  return {
    ...actual,
    formatInTimeZone: ((...args: Parameters<typeof actual.formatInTimeZone>) => {
      formatInTimeZoneSpy(...args);
      return actual.formatInTimeZone(...args);
    }) satisfies typeof actual.formatInTimeZone,
  };
});

import { DateTimeInClinicTz } from "@/components/date-time";

const BERLIN = "Europe/Berlin";

describe("DateTimeInClinicTz", () => {
  it("renders the clinic-local wall-clock time in a semantic <time> element", () => {
    render(<DateTimeInClinicTz value="2026-06-15T07:30:00.000Z" timeZone={BERLIN} />);
    // 07:30 UTC in June is 09:30 in Europe/Berlin (CEST, UTC+2).
    const time = screen.getByText(/09:30/);
    expect(time.tagName).toBe("TIME");
  });

  it("sets dateTime to the machine-readable UTC instant, independent of the display format", () => {
    render(<DateTimeInClinicTz value="2026-06-15T07:30:00.000Z" timeZone={BERLIN} />);
    const time = screen.getByText(/09:30/);
    expect(time).toHaveAttribute("datetime", "2026-06-15T07:30:00.000Z");
  });

  it("accepts a Date value and derives dateTime from its own ISO string", () => {
    const value = new Date("2026-06-15T07:30:00.000Z");
    render(<DateTimeInClinicTz value={value} timeZone={BERLIN} />);
    const time = screen.getByText(/09:30/);
    expect(time).toHaveAttribute("datetime", value.toISOString());
  });

  it("calls formatInTimeZone exactly once per render, and never imports date-fns-tz itself", () => {
    formatInTimeZoneSpy.mockClear();
    render(<DateTimeInClinicTz value="2026-06-15T07:30:00.000Z" timeZone={BERLIN} />);
    expect(formatInTimeZoneSpy).toHaveBeenCalledTimes(1);
  });

  it("honors a custom format string", () => {
    render(
      <DateTimeInClinicTz value="2026-06-15T07:30:00.000Z" timeZone={BERLIN} format="yyyy-MM-dd" />,
    );
    expect(screen.getByText("2026-06-15")).toBeInTheDocument();
  });
});
