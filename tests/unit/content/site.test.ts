import { describe, expect, it } from "vitest";

import { siteContent } from "@/content/site";

describe("siteContent", () => {
  it("has hero copy including a CTA label", () => {
    expect(siteContent.hero.headline.length).toBeGreaterThan(0);
    expect(siteContent.hero.subhead.length).toBeGreaterThan(0);
    expect(siteContent.hero.ctaLabel.length).toBeGreaterThan(0);
  });

  it("has exactly 3 How It Works steps", () => {
    expect(siteContent.howItWorks.steps).toHaveLength(3);
  });

  it("has at least 3 doctor bios", () => {
    expect(siteContent.about.doctors.length).toBeGreaterThanOrEqual(3);
  });

  it("has footer contact strings, with an Egyptian E.164 phone number", () => {
    expect(siteContent.contact.addressLines.length).toBeGreaterThan(0);
    expect(siteContent.contact.phoneE164).toMatch(/^\+[1-9]\d{6,14}$/);
    expect(siteContent.contact.phoneE164).toMatch(/^\+20\d{8,10}$/);
    expect(siteContent.contact.email).toContain("@");
  });

  it("carries no service prices: those come from the database", () => {
    // Guards the single-source-of-truth rule in this file's header comment.
    expect(JSON.stringify(siteContent)).not.toMatch(/priceMinor|durationMin/);
  });

  it("is written in Arabic, not machine-translated Latin-script copy", () => {
    // Guards against stray English/transliterated copy leaking into the hero.
    expect(siteContent.hero.headline).toMatch(/[؀-ۿ]/);
    expect(siteContent.clinicName).toMatch(/[؀-ۿ]/);
  });
});
