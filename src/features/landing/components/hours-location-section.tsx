import { Mail, MapPin, Phone } from "lucide-react";

import { siteContent } from "@/content/site";
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_NAMES_AR } from "@/lib/locale";
import { getClinicHoursForLanding } from "@/features/landing/queries";

/**
 * One weekday's opening hours, in `WorkingHour`'s own shape (C5): `weekday` is
 * 0=Sunday..6=Saturday, and `shifts` holds every open/close pair for that day in
 * clinic-LOCAL minutes-from-midnight (540 = 09:00). An empty `shifts` array means the
 * clinic is closed that day — Friday, as seeded, has none — and the component renders
 * "Closed" rather than silently omitting the row, since an absent row would be
 * indistinguishable from "this data failed to load."
 */
export interface HoursLocationDay {
  weekday: number;
  shifts: ReadonlyArray<{ openMinute: number; closeMinute: number }>;
}

export interface HoursLocationContact {
  /** Printed address, one line each (e.g. street, then postcode + city). */
  addressLines: readonly string[];
  /** Human-readable phone text shown to visitors — never used as a link target itself. */
  phoneDisplay: string;
  /** E.164 number; the only string this component puts in a `tel:` href. */
  phoneE164: string;
  email: string;
  mapUrl: string;
}

export interface HoursLocationSectionProps {
  /** All 7 weekdays, in any order — the component re-sorts to the Egyptian
   * Saturday-first display order (`WEEKDAY_DISPLAY_ORDER`, `@/lib/locale`). A
   * missing weekday renders as closed. */
  days: readonly HoursLocationDay[];
  contact: HoursLocationContact;
}

/**
 * Format a `WorkingHour.openMinute` / `closeMinute` value (minutes since clinic-LOCAL
 * midnight, C5) as `"HH:MM"`. Deliberately NOT in `@/lib/dates`: that module exists for
 * UTC<->clinic-local INSTANT conversions via `date-fns-tz` (C6), and a `WorkingHour` row
 * has no instant and no calendar date attached — it is already wall-clock-local, so turning
 * it into text is plain integer arithmetic, not a timezone concern.
 */
export function formatMinutesAsClockTime(minutesFromMidnight: number): string {
  const hours = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const minutes = String(minutesFromMidnight % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatShifts(shifts: HoursLocationDay["shifts"]): string {
  if (shifts.length === 0) {
    return "مغلق";
  }
  return shifts
    .map(
      (shift) =>
        `${formatMinutesAsClockTime(shift.openMinute)}–${formatMinutesAsClockTime(shift.closeMinute)}`,
    )
    .join(", ");
}

/**
 * Server Component by default (no `"use client"`): a pure function of its props with no
 * state, event handler, or browser API — which is exactly what keeps it trivially
 * unit-testable (render with hand-built props, no database needed). The DB read lives in
 * the sibling `loadHoursLocationSectionProps` loader below, never in this function.
 */
export function HoursLocationSection({ days, contact }: HoursLocationSectionProps) {
  const byWeekday = new Map(days.map((day) => [day.weekday, day] as const));

  return (
    <section
      id="hours-location"
      aria-labelledby="hours-location-heading"
      className="bg-card py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2
          id="hours-location-heading"
          className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Hours &amp; location
        </h2>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Opening hours
            </h3>
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Weekly opening hours</caption>
              <thead>
                <tr>
                  <th scope="col" className="sr-only">
                    اليوم
                  </th>
                  <th scope="col" className="sr-only">
                    المواعيد
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {WEEKDAY_DISPLAY_ORDER.map((weekday) => {
                  const shifts = byWeekday.get(weekday)?.shifts ?? [];
                  return (
                    <tr key={weekday}>
                      <th scope="row" className="py-2 pe-4 text-start font-medium text-foreground">
                        {WEEKDAY_NAMES_AR[weekday] ?? "—"}
                      </th>
                      <td className="py-2 text-end tabular-nums text-muted-foreground">
                        {formatShifts(shifts)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Visit us
            </h3>
            <address className="mt-4 space-y-3 text-sm not-italic leading-relaxed text-muted-foreground">
              <p className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {contact.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href={`tel:${contact.phoneE164}`}
                  className="rounded-sm text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {contact.phoneDisplay}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href={`mailto:${contact.email}`}
                  className="rounded-sm text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {contact.email}
                </a>
              </p>
              <p>
                {/* Plain external link — deliberately not a third-party map iframe (T3.5):
                    an embed would add a cross-origin request, hurt the Lighthouse budget
                    (C23), and leak visitor data to the map provider. */}
                <a
                  href={contact.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  View on map
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </address>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Build-time data loader (C15: the landing page is SSG; this is this section's one read,
 * matching the already-accepted `getActiveServicesForLanding` pattern elsewhere on this
 * page). Reads `ClinicSettings` + `WorkingHour` from the database — never
 * `src/content/site.ts` for the hours or address themselves, since only the admin-editable
 * DB rows can reflect a Phase-10 edit (T3.5's own requirement).
 *
 * `phoneDisplay` is the one deliberate exception: `ClinicSettings` stores only the E.164
 * form, and this repo has no phone-formatting helper yet (`src/lib/phone.ts` is a later
 * phase's file, C17), so the human-readable text is `site.ts`'s already-written copy. The
 * `tel:` link target itself still comes from the database, so a future admin edit to the
 * number is never silently wrong — only the cosmetic label can lag until a later phase adds
 * real E.164 formatting.
 */
export async function loadHoursLocationSectionProps(): Promise<HoursLocationSectionProps> {
  const { settings, workingHours } = await getClinicHoursForLanding();

  const days: HoursLocationDay[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    shifts: workingHours
      .filter((hour) => hour.weekday === weekday)
      .map((hour) => ({ openMinute: hour.openMinute, closeMinute: hour.closeMinute })),
  }));

  return {
    days,
    contact: {
      addressLines: [settings.addressLine1, settings.addressLine2].filter(
        (line): line is string => line.length > 0,
      ),
      phoneDisplay: siteContent.contact.phoneDisplay,
      phoneE164: settings.phoneE164,
      email: settings.email,
      mapUrl: settings.mapUrl,
    },
  };
}
