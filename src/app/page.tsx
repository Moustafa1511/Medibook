import type { Metadata } from "next";

import { SiteFooter, type SiteFooterContent } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteContent } from "@/content/site";
import { WEEKDAY_DISPLAY_ORDER } from "@/lib/locale";
import { AboutSection } from "@/features/landing/components/about-section";
import { HeroSection } from "@/features/landing/components/hero-section";
import {
  HoursLocationSection,
  formatMinutesAsClockTime,
  loadHoursLocationSectionProps,
} from "@/features/landing/components/hours-location-section";
import { HowItWorksSection } from "@/features/landing/components/how-it-works-section";
import {
  ServicesSection,
  loadServicesSectionProps,
} from "@/features/landing/components/services-section";

/**
 * Statically generated at build time (C15). The two loaders below are the only
 * data reads on this page, and they run during `next build`, not per request —
 * so the landing page honours the brief's "no runtime data fetching".
 *
 * A service or opening-hours edit in the admin UI therefore needs a rebuild or a
 * revalidatePath("/"); that trade-off is stated in Section 1 and Section 2.3.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const dynamic = "force-static";
export const revalidate = false;

/** Reuse the hours already loaded for the page so the footer costs no extra query. */
function buildFooterContent(
  days: ReadonlyArray<{
    weekday: number;
    shifts: ReadonlyArray<{ openMinute: number; closeMinute: number }>;
  }>,
): SiteFooterContent {
  const byWeekday = new Map(days.map((day) => [day.weekday, day.shifts]));

  return {
    clinicName: siteContent.clinicName,
    phoneDisplay: siteContent.contact.phoneDisplay,
    phoneHref: `tel:${siteContent.contact.phoneE164}`,
    email: siteContent.contact.email,
    addressLine1: siteContent.contact.addressLines[1] ?? siteContent.contact.addressLines[0] ?? "",
    addressLine2: siteContent.contact.addressLines[2],
    hours: WEEKDAY_DISPLAY_ORDER.map((weekday) => {
      const shifts = byWeekday.get(weekday) ?? [];
      return {
        weekday,
        hoursLabel:
          shifts.length === 0
            ? "مغلق"
            : shifts
                .map(
                  (shift) =>
                    `${formatMinutesAsClockTime(shift.openMinute)}–${formatMinutesAsClockTime(shift.closeMinute)}`,
                )
                .join(", "),
      };
    }),
    legalLinks: [
      { href: "/privacy", label: "الخصوصية" },
      { href: "/terms", label: "الشروط" },
    ],
  };
}

export default async function HomePage() {
  const [servicesProps, hoursProps] = await Promise.all([
    loadServicesSectionProps(),
    loadHoursLocationSectionProps(),
  ]);

  return (
    <>
      <SiteHeader currentPath="/" />
      {/* Section order is the brief's order and is deliberate. */}
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <ServicesSection services={servicesProps.services} />
        <AboutSection />
        <HowItWorksSection />
        <HoursLocationSection days={hoursProps.days} contact={hoursProps.contact} />
      </main>
      <SiteFooter content={buildFooterContent(hoursProps.days)} />
    </>
  );
}
