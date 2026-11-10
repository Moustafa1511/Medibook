import { formatInTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DEFAULT_FORMAT = "d MMM yyyy, HH:mm";

export interface DateTimeInClinicTzProps {
  /** The UTC instant to render. A `Date`, or an ISO-8601 string that `formatInTimeZone` accepts directly. */
  value: Date | string;
  /** IANA zone to render `value` in (e.g. `ClinicSettings.timeZone`) — never read from env; always a prop (C6). */
  timeZone: string;
  /** `date-fns` format string. Defaults to a clinic-local date + 24h time. */
  format?: string;
  className?: string;
}

/**
 * Renders a UTC instant as clinic-local wall-clock text inside a semantic `<time>`
 * element, whose `dateTime` attribute stays machine-readable UTC regardless of the
 * human-facing format. All formatting goes through `@/lib/dates`'s `formatInTimeZone`
 * (C6) — this file does not import `date-fns-tz` itself (enforced repo-wide by the
 * module-boundary test in tests/unit/lib/dates.test.ts).
 *
 * A plain Server Component: it takes `timeZone` as a prop rather than resolving it
 * itself, so the caller (who already has the clinic's settings loaded) decides which
 * zone applies.
 */
export function DateTimeInClinicTz({
  value,
  timeZone,
  format = DEFAULT_FORMAT,
  className,
}: DateTimeInClinicTzProps) {
  const machineReadable = typeof value === "string" ? value : value.toISOString();
  // Exactly one call per render — the formatted string below is the only read of it.
  const formatted = formatInTimeZone(value, timeZone, format);

  return (
    <time dateTime={machineReadable} className={cn("tabular-nums", className)}>
      {formatted}
    </time>
  );
}
