import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HowItWorksSection } from "@/features/landing/components/how-it-works-section";
import { siteContent } from "@/content/site";

describe("HowItWorksSection", () => {
  it("renders exactly 3 list items, in content order", () => {
    render(<HowItWorksSection />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(siteContent.howItWorks.steps).toHaveLength(3);

    items.forEach((item, index) => {
      const step = siteContent.howItWorks.steps[index];
      expect(step).toBeDefined();
      if (!step) {
        return;
      }
      expect(within(item).getByRole("heading", { level: 3, name: step.title })).toBeInTheDocument();
      expect(within(item).getByText(step.body)).toBeInTheDocument();
    });
  });

  it("renders the steps inside a native <ol>, not a styled <div> grid", () => {
    const { container } = render(<HowItWorksSection />);
    expect(container.querySelector("ol")).not.toBeNull();
  });

  it("hides the decorative step-number badge from assistive tech", () => {
    render(<HowItWorksSection />);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    items.forEach((item, index) => {
      const badge = within(item).getByText(String(index + 1));
      expect(badge).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("exposes the section's accessible name via its heading", () => {
    render(<HowItWorksSection />);
    const heading = screen.getByRole("heading", {
      level: 2,
      name: siteContent.howItWorks.heading,
    });
    const section = heading.closest("section");
    expect(section).toHaveAccessibleName(siteContent.howItWorks.heading);
  });

  it('carries no "use client" directive', async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(process.cwd(), "src/features/landing/components/how-it-works-section.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/use client/);
  });
});
