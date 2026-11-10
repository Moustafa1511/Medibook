import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  formatDurationLabel,
  ServicesSection,
} from "@/features/landing/components/services-section";
import type { ServiceCardView } from "@/features/landing/types";

// Mirrors prisma/seed.ts's 7 seeded Service rows exactly (slug/name/durationMin/
// priceMinor), so this test exercises the real catalogue shape without touching the
// database. ServicesSection is a pure function of its `services` prop (see its own
// doc comment) — the Prisma read lives in `loadServicesSectionProps`, which this
// test deliberately does not call.
const SEEDED_SERVICES: ServiceCardView[] = [
  {
    slug: "general-consultation",
    name: "General Consultation",
    description: "A standard appointment to discuss symptoms or get a referral.",
    durationMin: 30,
    priceMinor: 5000,
  },
  {
    slug: "follow-up-visit",
    name: "Follow-up Visit",
    description: "A short review of an ongoing treatment or recent test results.",
    durationMin: 15,
    priceMinor: 3000,
  },
  {
    slug: "vaccination",
    name: "Vaccination",
    description: "Routine or travel immunisation, including seasonal vaccines.",
    durationMin: 15,
    priceMinor: 2500,
  },
  {
    slug: "dental-cleaning",
    name: "Dental Cleaning",
    description: "Professional scaling and polishing with an oral health check.",
    durationMin: 45,
    priceMinor: 8000,
  },
  {
    slug: "physical-therapy",
    name: "Physical Therapy Session",
    description: "One-to-one rehabilitation and mobility work with a physiotherapist.",
    durationMin: 60,
    priceMinor: 9000,
  },
  {
    slug: "diagnostic-ultrasound",
    name: "Diagnostic Ultrasound",
    description: "Non-invasive imaging, with the results reviewed during the appointment.",
    durationMin: 45,
    priceMinor: 12000,
  },
  {
    slug: "minor-outpatient-procedure",
    name: "Minor Outpatient Procedure",
    description: "A longer slot for minor procedures performed under local anaesthetic.",
    durationMin: 90,
    priceMinor: 20000,
  },
];

describe("ServicesSection", () => {
  it("renders all 7 seeded service names", () => {
    render(<ServicesSection services={SEEDED_SERVICES} />);
    for (const service of SEEDED_SERVICES) {
      expect(screen.getByText(service.name)).toBeInTheDocument();
    }
  });

  it("formats each price through MoneyDisplay in the clinic's configured currency", () => {
    render(<ServicesSection services={SEEDED_SERVICES} />);
    // CLINIC_CURRENCY is "EGP" in the test environment, matching the seeded
    // ClinicSettings row. Intl splits the formatted value across nodes and wraps
    // it in invisible RTL marks, so assert on the rendered text content.
    const body = document.body.textContent ?? "";
    expect(body).toContain("ج.م.");
    expect(body).toContain("50.00");
    expect(body).toContain("200.00");
  });

  it("renders a human-readable duration derived from durationMin, never a raw number", () => {
    render(<ServicesSection services={SEEDED_SERVICES} />);
    expect(screen.getByText("30 دقيقة")).toBeInTheDocument();
    expect(screen.getByText("1 ساعة")).toBeInTheDocument();
    expect(screen.getByText("1 ساعة 30 دقيقة")).toBeInTheDocument();
  });

  it("gives the section an id the hero's secondary CTA can target", () => {
    const { container } = render(<ServicesSection services={SEEDED_SERVICES} />);
    expect(container.querySelector("section#services")).not.toBeNull();
  });

  it("links every service's Book action to /book, named distinctly per service", () => {
    render(<ServicesSection services={SEEDED_SERVICES} />);
    const bookLinks = screen.getAllByRole("link", { name: /احجز/u });
    expect(bookLinks).toHaveLength(7);
    for (const link of bookLinks) {
      expect(link).toHaveAttribute("href", "/book");
    }
  });

  it("gives the section a heading referenced by aria-labelledby", () => {
    const { container } = render(<ServicesSection services={SEEDED_SERVICES} />);
    const heading = screen.getByRole("heading", { level: 2 });
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("formatDurationLabel", () => {
  it("renders minutes-only durations under an hour as '<n> min'", () => {
    expect(formatDurationLabel(30)).toBe("30 دقيقة");
    expect(formatDurationLabel(15)).toBe("15 دقيقة");
  });

  it("renders exact-hour durations as '<n> h'", () => {
    expect(formatDurationLabel(60)).toBe("1 ساعة");
    expect(formatDurationLabel(120)).toBe("2 ساعة");
  });

  it("renders mixed hour+minute durations as '<n> h <m> min'", () => {
    expect(formatDurationLabel(90)).toBe("1 ساعة 30 دقيقة");
  });
});
