import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HeroSection } from "@/features/landing/components/hero-section";
import { siteContent } from "@/content/site";

describe("HeroSection", () => {
  it("renders exactly one h1 with the hero headline from siteContent", () => {
    render(<HeroSection />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(siteContent.hero.headline);
  });

  it('renders a primary CTA anchor whose href is exactly "/book"', () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: siteContent.hero.ctaLabel });
    expect(cta).toHaveAttribute("href", "/book");
  });

  it("renders a secondary CTA anchor pointing at the services section anchor", () => {
    render(<HeroSection />);
    const secondaryCta = screen.getByRole("link", { name: siteContent.hero.secondaryCtaLabel });
    expect(secondaryCta).toHaveAttribute("href", "#services");
  });

  it("renders every reassurance bullet from siteContent", () => {
    render(<HeroSection />);
    for (const item of siteContent.hero.reassurance) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders the subhead", () => {
    render(<HeroSection />);
    expect(screen.getByText(siteContent.hero.subhead)).toBeInTheDocument();
  });
});
