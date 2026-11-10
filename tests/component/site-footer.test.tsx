import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter, type SiteFooterContent } from "@/components/site-footer";

const content: SiteFooterContent = {
  clinicName: "MediBook Clinic",
  phoneDisplay: "+49 30 1234 5678",
  phoneHref: "tel:+493012345678",
  email: "hello@medibook.example",
  addressLine1: "123 Hauptstrasse",
  addressLine2: "10115 Berlin",
  hours: [
    { weekday: 1, hoursLabel: "09:00–18:00" },
    { weekday: 0, hoursLabel: "مغلق" },
  ],
  legalLinks: [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ],
};

describe("SiteFooter", () => {
  it("renders clinic contact details from props, never from a database or env read", () => {
    render(<SiteFooter content={content} />);
    expect(screen.getByText("MediBook Clinic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: content.phoneDisplay })).toHaveAttribute(
      "href",
      content.phoneHref,
    );
    expect(screen.getByRole("link", { name: content.email })).toHaveAttribute(
      "href",
      `mailto:${content.email}`,
    );
  });

  it("renders every supplied opening-hours entry", () => {
    render(<SiteFooter content={content} />);
    expect(screen.getByText("الاثنين")).toBeInTheDocument();
    expect(screen.getByText("09:00–18:00")).toBeInTheDocument();
    expect(screen.getByText("الأحد")).toBeInTheDocument();
    expect(screen.getByText("مغلق")).toBeInTheDocument();
  });

  it("renders every legal link with its href", () => {
    render(<SiteFooter content={content} />);
    const legalHeading = screen.getByRole("heading", { name: "معلومات قانونية" });
    const legalSection = legalHeading.parentElement;
    if (!legalSection) {
      throw new Error("معلومات قانونية heading has no parent section to scope the query to");
    }
    const links = within(legalSection).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/privacy", "/terms"]);
  });
});
