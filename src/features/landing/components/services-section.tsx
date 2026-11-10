import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/money-display";
import { env } from "@/lib/env";
import { LOCALE } from "@/lib/locale";

import { getActiveServicesForLanding } from "@/features/landing/queries";
import type { ServiceCardView } from "@/features/landing/types";

export interface ServicesSectionProps {
  services: readonly ServiceCardView[];
}

/**
 * "30" -> "30 دقيقة"; "90" -> "1 ساعة 30 دقيقة"; "60" -> "1 ساعة". `durationMin` (C5) is
 * a plain integer duration, not a clinic-local wall-clock time, so this is ordinary
 * integer arithmetic rather than a `@/lib/dates` concern (C6 only governs
 * instants/wall time).
 */
export function formatDurationLabel(durationMin: number): string {
  if (durationMin < 60) {
    return `${durationMin} دقيقة`;
  }
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes === 0 ? `${hours} ساعة` : `${hours} ساعة ${minutes} دقيقة`;
}

/**
 * Server Component by default (no `"use client"`): a pure function of its `services`
 * prop with no state, event handler or browser API — which is what keeps it trivially
 * unit-testable (render with a hand-built fixture array; no database needed, and an
 * async Server Component cannot be rendered directly under @testing-library/react +
 * jsdom). The one Prisma read for this data lives in the sibling
 * `loadServicesSectionProps` loader below, matching the `loadHoursLocationSectionProps`
 * pattern already established on this page (T3.5) — the page composes sections by
 * awaiting a loader and spreading its result into the matching props type, not by
 * rendering an async section component directly.
 */
export function ServicesSection({ services }: ServicesSectionProps) {
  return (
    <section id="services" aria-labelledby="services-heading" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2
          id="services-heading"
          className="font-display text-2xl font-bold leading-snug text-foreground md:text-3xl"
        >
          خدماتنا
        </h2>

        {/* A <ul>, not a bare grid of <div>s, so assistive tech announces this as a
            list of N services rather than an undifferentiated block of text. */}
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.slug}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
                <div>
                  <h3 className="font-display text-xl font-semibold leading-snug text-foreground">
                    {service.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    {formatDurationLabel(service.durationMin)}
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    <MoneyDisplay
                      minor={service.priceMinor}
                      currency={env.CLINIC_CURRENCY}
                      locale={LOCALE}
                    />
                  </span>
                </div>

                {/* C18: a solid button with a normal-size label uses bg-primary-button /
                    hover:bg-primary-button-hover, never bg-primary (3.65:1, fails AA). The
                    visible label is just "احجز" — the service name is added via aria-label
                    (WCAG 2.5.3: the visible text "احجز" is a substring of the accessible
                    name) so each of the 7 cards' links announce distinctly to a screen
                    reader instead of as 7 identical "احجز" links. */}
                <Button
                  asChild
                  className="w-full bg-primary-button text-primary-foreground hover:bg-primary-button-hover"
                >
                  <Link href="/book" aria-label={`احجز ${service.name}`}>
                    احجز
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Build-time data loader (C15: the landing page is SSG; this is this section's one
 * Prisma read). Matches the `loadHoursLocationSectionProps` pattern already
 * established on this page (T3.5): `page.tsx` awaits this loader and spreads its
 * result into `<ServicesSection>` as props, rather than this file exporting an async
 * component. `getActiveServicesForLanding` (`features/landing/queries.ts`) is called
 * from exactly this one place — do not add a second call site.
 */
export async function loadServicesSectionProps(): Promise<ServicesSectionProps> {
  const services = await getActiveServicesForLanding();
  return { services };
}
