import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AboutSection } from "@/features/landing/components/about-section";
import { siteContent } from "@/content/site";

describe("AboutSection", () => {
  it("renders every doctor name from siteContent", () => {
    render(<AboutSection />);

    for (const doctor of siteContent.about.doctors) {
      expect(screen.getByRole("heading", { level: 3, name: doctor.name })).toBeInTheDocument();
    }
  });

  it("renders the about heading as the section's accessible name", () => {
    render(<AboutSection />);

    const heading = screen.getByRole("heading", { level: 2, name: siteContent.about.heading });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(section).toHaveAccessibleName(siteContent.about.heading);
  });

  it("renders every doctor's role, credentials and bio", () => {
    render(<AboutSection />);

    for (const doctor of siteContent.about.doctors) {
      expect(screen.getByText(doctor.role)).toBeInTheDocument();
      expect(screen.getByText(doctor.credentials)).toBeInTheDocument();
      expect(screen.getByText(doctor.bio)).toBeInTheDocument();
    }
  });

  it("marks each initials avatar as decorative, never as a real <img>", () => {
    const { container } = render(<AboutSection />);

    // No <img> anywhere - no photographs, per the task constraint - and every
    // avatar is hidden from the accessibility tree (the adjacent name already
    // carries that information as real text, so re-announcing initials would
    // be redundant/confusing to a screen reader).
    expect(screen.queryAllByRole("img")).toHaveLength(0);

    const avatars = container.querySelectorAll('[aria-hidden="true"]');
    expect(avatars.length).toBeGreaterThanOrEqual(siteContent.about.doctors.length);
  });

  it('carries no "use client" directive', async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(process.cwd(), "src/features/landing/components/about-section.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/use client/);
  });
});
