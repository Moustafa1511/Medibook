/**
 * Data reads for the landing page (`/`), per feature (C17: `features/<feature>/queries.ts`).
 * The landing page is SSG with no runtime data fetching (C15) — every export here is read
 * once at build time, never from a client or a request handler.
 *
 * OWNERSHIP NOTE: this file is shared across several Phase 3 tasks. Another task owns
 * `getActiveServicesForLanding()` (T3.3/T3.4 territory) and may add it above or below this
 * comment block; when it does, APPEND your own function rather than reformatting or
 * reordering anything you did not write, exactly as T3.5 added `getClinicHoursForLanding`
 * below without touching anything else in this file.
 */

import { db } from "@/server/db";

import type { ServiceCardView } from "./types";

/**
 * The landing page's one build-time Prisma read for its services catalogue (C15).
 * Called from exactly one place — `loadServicesSectionProps` in
 * `components/services-section.tsx` — so a grep for this name finds exactly one call
 * site plus this definition. Do not add a second caller; a different page that needs
 * the active service list should get its own query in its own feature instead of
 * reaching into this one.
 */
export async function getActiveServicesForLanding(): Promise<ServiceCardView[]> {
  return db.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
      durationMin: true,
      priceMinor: true,
    },
  });
}

/** Everything `HoursLocationSection` needs, in the shape the database actually returns it. */
export interface ClinicHoursForLanding {
  settings: {
    addressLine1: string;
    addressLine2: string;
    phoneE164: string;
    email: string;
    mapUrl: string;
    timeZone: string;
  };
  /** Every `WorkingHour` row, ordered by weekday then start time. A weekday with no rows
   * (Sunday, as seeded) simply has none here — the caller must render that as closed
   * rather than omitting the day (T3.5). */
  workingHours: Array<{ weekday: number; openMinute: number; closeMinute: number }>;
}

/**
 * Reads the `ClinicSettings` singleton and every `WorkingHour` row for the landing page's
 * Hours/Location section (T3.5). This is a DB read rather than `src/content/site.ts`
 * because the admin can edit both tables from `/admin/settings` in Phase 10 — baking
 * opening hours into static copy would silently drift from what the clinic actually does.
 */
export async function getClinicHoursForLanding(): Promise<ClinicHoursForLanding> {
  const [settings, workingHours] = await Promise.all([
    db.clinicSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    db.workingHour.findMany({
      select: { weekday: true, openMinute: true, closeMinute: true },
      orderBy: [{ weekday: "asc" }, { openMinute: "asc" }],
    }),
  ]);

  return {
    settings: {
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      phoneE164: settings.phoneE164,
      email: settings.email,
      mapUrl: settings.mapUrl,
      timeZone: settings.timeZone,
    },
    workingHours,
  };
}
