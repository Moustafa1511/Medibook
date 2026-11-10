import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TermsPage, { metadata } from "@/app/terms/page";
import { siteContent } from "@/content/site";

describe("TermsPage", () => {
  it("renders exactly one h1", () => {
    render(<TermsPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "الشروط والأحكام" })).toBeInTheDocument();
  });

  it("states plainly at the top that this is an unreviewed template", () => {
    render(<TermsPage />);
    expect(screen.getByText(/نموذج مبدئي/)).toBeInTheDocument();
  });

  it("says the site is not for medical emergencies and points at the out-of-hours number", () => {
    render(<TermsPage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/ليس خدمة إسعاف أو رعاية عاجلة/);
    expect(body).toContain(siteContent.contact.hoursNote);
  });

  it("states prices shown are for the appointment booked", () => {
    render(<TermsPage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/السعر الظاهر وقت الحجز/);
  });

  it("sets no-show and cancellation expectations", () => {
    render(<TermsPage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/الإلغاء/);
    expect(body).toMatch(/رسومًا على التخلف عن الحضور/);
  });

  it("links to the سياسة الخصوصية", () => {
    render(<TermsPage />);
    expect(screen.getByRole("link", { name: "سياسة الخصوصية" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("reuses SiteHeader and SiteFooter", () => {
    render(<TermsPage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("exports real page metadata", () => {
    expect(metadata.title as string).toContain("الشروط والأحكام");
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(0);
  });
});
