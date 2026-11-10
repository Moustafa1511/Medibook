import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { WEEKDAY_NAMES_AR } from "@/lib/locale";
import { cn } from "@/lib/utils";

/**
 * One day's opening-hours row. `weekday` matches the `WorkingHour.weekday`
 * convention used elsewhere in the app (0 = Sunday .. 6 = Saturday, C5).
 * `hoursLabel` is pre-formatted ("09:00–18:00" or "مغلق") by the caller —
 * this component never resolves clinic-local wall time itself, since only
 * `@/lib/dates` may do that (C6).
 */
export interface SiteFooterHoursEntry {
  weekday: number;
  hoursLabel: string;
}

export interface SiteFooterLegalLink {
  href: string;
  label: string;
}

export interface SiteFooterContent {
  clinicName: string;
  phoneDisplay: string;
  /** `tel:` href, e.g. `"tel:+493012345678"`. */
  phoneHref: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  hours: SiteFooterHoursEntry[];
  legalLinks: SiteFooterLegalLink[];
}

export interface SiteFooterProps {
  /**
   * All copy is supplied by the caller — this component never reads a
   * database or `process.env` (T2.8). Phase 3 builds this object from
   * `src/content/site.ts` (and the clinic's real working hours) and passes
   * it in; this file only defines the shape that object must have.
   */
  content: SiteFooterContent;
  className?: string;
}

// Indexed by JS getDay() (0 = Sunday), shared with the rest of the app so the
// weekday naming cannot drift between the footer and the hours section.
const WEEKDAY_LABELS: readonly string[] = [0, 1, 2, 3, 4, 5, 6].map(
  (d) => WEEKDAY_NAMES_AR[d] ?? "",
);

/** Public footer: clinic contact details, opening hours, legal links. */
export function SiteFooter({ content, className }: SiteFooterProps) {
  return (
    <footer className={cn("border-t border-border bg-card", className)}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{content.clinicName}</p>
          <address className="mt-4 space-y-2 text-sm not-italic text-muted-foreground">
            <p className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {content.addressLine1}
                {content.addressLine2 ? `, ${content.addressLine2}` : ""}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
              <a href={content.phoneHref} className="hover:text-foreground hover:underline">
                {content.phoneDisplay}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
              <a href={`mailto:${content.email}`} className="hover:text-foreground hover:underline">
                {content.email}
              </a>
            </p>
          </address>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground">مواعيد العمل</h2>
          <dl className="mt-4 space-y-1 text-sm text-muted-foreground">
            {content.hours.map((entry) => (
              <div key={entry.weekday} className="flex justify-between gap-4">
                <dt>{WEEKDAY_LABELS[entry.weekday] ?? "—"}</dt>
                <dd>{entry.hoursLabel}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground">معلومات قانونية</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {content.legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
        &copy; {content.clinicName}. All rights reserved.
      </div>
    </footer>
  );
}
