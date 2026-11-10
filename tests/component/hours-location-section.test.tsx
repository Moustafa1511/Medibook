import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  formatMinutesAsClockTime,
  HoursLocationSection,
  type HoursLocationDay,
} from "@/features/landing/components/hours-location-section";

/** Mirrors the real seeded `WorkingHour` rows (Mon-Fri 09:00-18:00, Saturday split
 * 09:00-13:00 + 16:00-20:00, Sunday closed) so the test exercises the exact shape the
 * build-time loader will actually produce. */
const SEEDED_DAYS: HoursLocationDay[] = [
  { weekday: 0, shifts: [] }, // Sunday — closed, zero rows
  { weekday: 1, shifts: [{ openMinute: 540, closeMinute: 1080 }] },
  { weekday: 2, shifts: [{ openMinute: 540, closeMinute: 1080 }] },
  { weekday: 3, shifts: [{ openMinute: 540, closeMinute: 1080 }] },
  { weekday: 4, shifts: [{ openMinute: 540, closeMinute: 1080 }] },
  { weekday: 5, shifts: [{ openMinute: 540, closeMinute: 1080 }] },
  {
    weekday: 6,
    shifts: [
      { openMinute: 540, closeMinute: 780 },
      { openMinute: 960, closeMinute: 1200 },
    ],
  },
];

const CONTACT = {
  addressLines: ["Friedrichstrasse 12", "10117 Berlin"],
  phoneDisplay: "+49 30 1234 5678",
  phoneE164: "+493012345678",
  email: "hello@medibook.example",
  mapUrl: "https://www.openstreetmap.org/?mlat=52.5163&mlon=13.3777#map=17/52.5163/13.3777",
};

describe("formatMinutesAsClockTime", () => {
  it("formats 540 minutes-from-midnight as 09:00", () => {
    expect(formatMinutesAsClockTime(540)).toBe("09:00");
  });

  it("formats 1080 minutes-from-midnight as 18:00", () => {
    expect(formatMinutesAsClockTime(1080)).toBe("18:00");
  });

  it("zero-pads single-digit hours and minutes", () => {
    expect(formatMinutesAsClockTime(5)).toBe("00:05");
  });
});

describe("HoursLocationSection", () => {
  it("renders a weekday with zero WorkingHour rows as مغلق, not omitted", () => {
    render(<HoursLocationSection days={SEEDED_DAYS} contact={CONTACT} />);
    const sundayHeader = screen.getByRole("rowheader", { name: "الأحد" });
    const row = sundayHeader.closest("tr");
    if (!row) throw new Error("الأحد row header has no parent <tr>");
    expect(within(row).getByText("مغلق")).toBeInTheDocument();
  });

  it("renders both of السبت's split-shift ranges in one row", () => {
    render(<HoursLocationSection days={SEEDED_DAYS} contact={CONTACT} />);
    const saturdayHeader = screen.getByRole("rowheader", { name: "السبت" });
    const row = saturdayHeader.closest("tr");
    if (!row) throw new Error("السبت row header has no parent <tr>");
    const cell = within(row).getByRole("cell");
    expect(cell.textContent).toContain("09:00");
    expect(cell.textContent).toContain("13:00");
    expect(cell.textContent).toContain("16:00");
    expect(cell.textContent).toContain("20:00");
  });

  it("renders all seven weekdays", () => {
    render(<HoursLocationSection days={SEEDED_DAYS} contact={CONTACT} />);
    for (const label of ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]) {
      expect(screen.getByRole("rowheader", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a tel: link using the E.164 number and a mailto: link", () => {
    render(<HoursLocationSection days={SEEDED_DAYS} contact={CONTACT} />);
    expect(screen.getByRole("link", { name: CONTACT.phoneDisplay })).toHaveAttribute(
      "href",
      `tel:${CONTACT.phoneE164}`,
    );
    expect(screen.getByRole("link", { name: CONTACT.email })).toHaveAttribute(
      "href",
      `mailto:${CONTACT.email}`,
    );
  });

  it("renders a plain external link to the map URL, not an iframe", () => {
    render(<HoursLocationSection days={SEEDED_DAYS} contact={CONTACT} />);
    const mapLink = screen.getByRole("link", { name: /view on map/i });
    expect(mapLink).toHaveAttribute("href", CONTACT.mapUrl);
    expect(mapLink.tagName).toBe("A");
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("renders the section as a landmark with an accessible name from its own heading", () => {
    render(<HoursLocationSection days={SEEDED_DAYS} contact={CONTACT} />);
    expect(screen.getByRole("region", { name: /hours.*location/i })).toBeInTheDocument();
  });
});
