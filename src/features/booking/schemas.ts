import { z } from "zod";

/**
 * Booking input schemas. The SAME objects are used by the client forms and by
 * the server actions (C17), so validation can never drift between them.
 */

/** "YYYY-MM-DD" that is also a real calendar date (rejects 2026-02-30). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be formatted YYYY-MM-DD")
  .refine((value) => {
    const parts = value.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (month < 1 || month > 12 || day < 1) return false;
    // Day 0 of the next month is the last day of this one.
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= daysInMonth;
  }, "must be a real calendar date");

/** "YYYY-MM" with a valid month. */
const isoMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "must be formatted YYYY-MM")
  .refine((value) => {
    const month = Number(value.split("-")[1]);
    return month >= 1 && month <= 12;
  }, "must be a real calendar month");

export const monthAvailabilityInput = z.object({
  serviceId: z.string().min(1),
  yearMonth: isoMonth,
});

export const daySlotsInput = z.object({
  serviceId: z.string().min(1),
  dateLocal: isoDate,
});

export type MonthAvailabilityInput = z.infer<typeof monthAvailabilityInput>;
export type DaySlotsInput = z.infer<typeof daySlotsInput>;
