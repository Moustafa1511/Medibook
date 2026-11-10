import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLogo } from "@/components/app-logo";
import { siteContent } from "@/content/site";

describe("AppLogo", () => {
  it("names the link once, with the clinic name", () => {
    render(<AppLogo />);
    // Regression guard: the mark used to carry aria-label AND an SVG <title> AND
    // the name as SVG text, so the link announced the name twice.
    const link = screen.getByRole("link", { name: siteContent.clinicName });
    expect(link.textContent).toBe(siteContent.clinicName);
  });

  it("draws the mark inline rather than requesting an image", () => {
    const { container } = render(<AppLogo />);
    expect(container.querySelector("img")).toBeNull();
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // Decorative: the adjacent text already names the link, so the mark must not
    // add a second accessible name.
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the clinic name as real text, so Arabic shapes and scales properly", () => {
    render(<AppLogo />);
    expect(screen.getByText(siteContent.clinicName)).toBeInTheDocument();
  });

  it("falls back to an aria-label when showing the mark alone", () => {
    render(<AppLogo markOnly />);
    const link = screen.getByRole("link", { name: siteContent.clinicName });
    expect(link.textContent).toBe("");
  });

  it("links to the home page by default", () => {
    render(<AppLogo />);
    expect(screen.getByRole("link", { name: siteContent.clinicName })).toHaveAttribute("href", "/");
  });

  it("links to a caller-supplied href", () => {
    render(<AppLogo href="/admin" />);
    expect(screen.getByRole("link", { name: siteContent.clinicName })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
