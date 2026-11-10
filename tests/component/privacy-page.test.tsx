import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage, { metadata } from "@/app/privacy/page";
import { siteContent } from "@/content/site";

describe("PrivacyPage", () => {
  it("renders exactly one h1 and states C20's retention numbers in plain text", () => {
    render(<PrivacyPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "سياسة الخصوصية" })).toBeInTheDocument();

    // Acceptance criteria (T3.6): the rendered text must contain these two
    // literal substrings, matching C20's anonymize/delete/OTP numbers.
    const body = document.body.textContent ?? "";
    expect(body).toContain("24 شهرًا");
    expect(body).toContain("24 ساعة");
  });

  it("names the data controller and retention figure from siteContent, not a hardcoded copy", () => {
    render(<PrivacyPage />);
    const body = document.body.textContent ?? "";
    expect(body).toContain(siteContent.legal.dataController);
    expect(body).toContain(String(siteContent.legal.retentionMonths));
  });

  it("states plainly at the top that this is an unreviewed template", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/نموذج مبدئي/)).toBeInTheDocument();
  });

  it("describes the minimal data collected and the single SMS processor", () => {
    render(<PrivacyPage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/اسمك الكامل ورقم هاتفك/);
    expect(body).toMatch(/لا نطلب عنوان بريد إلكتروني/);
    expect(body).toMatch(/شركة خارجية واحدة فقط/);
  });

  it("states no cookie banner is shown because the only cookie is the admin session cookie", () => {
    render(<PrivacyPage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/الكوكي الوحيد/);
    expect(body).toMatch(/كوكي تسجيل دخول/);
  });

  it("gives the clinic's phone and email as the way to request access or deletion", () => {
    render(<PrivacyPage />);
    // Scoped to <main>: SiteFooter repeats the same phone/email as its own
    // links, so an unscoped query would match twice.
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("link", { name: siteContent.contact.phoneDisplay })).toHaveAttribute(
      "href",
      `tel:${siteContent.contact.phoneE164}`,
    );
    expect(main.getByRole("link", { name: siteContent.contact.email })).toHaveAttribute(
      "href",
      `mailto:${siteContent.contact.email}`,
    );
  });

  it("reuses SiteHeader and SiteFooter", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "انتقل إلى المحتوى" })).toBeInTheDocument();
  });

  it("exports real page metadata", () => {
    expect(metadata.title as string).toContain("سياسة الخصوصية");
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(0);
  });
});
