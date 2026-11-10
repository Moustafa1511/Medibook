import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
  it("renders a skip-to-content link before the rest of the header", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "انتقل إلى المحتوى" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });

  it("renders exactly four primary nav anchors by default (desktop nav only, sheet closed)", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "التنقل الرئيسي" });
    const anchors = within(nav).getAllByRole("link");
    expect(anchors).toHaveLength(4);
    expect(anchors.map((a) => a.textContent)).toEqual([
      "الرئيسية",
      "الخصوصية",
      "الشروط",
      "احجز موعداً",
    ]);
  });

  it("points the CTA at /book styled with the AA-contrast button fill, never bg-primary", () => {
    render(<SiteHeader />);
    // `Button asChild` renders no separate <button> — Radix's Slot merges the
    // button's classes directly onto this single <a>, so the anchor itself
    // carries them.
    const cta = screen.getByRole("link", { name: "احجز موعداً" });
    expect(cta).toHaveAttribute("href", "/book");
    expect(cta).toHaveClass("bg-primary-button");
    expect(cta).toHaveClass("hover:bg-primary-button-hover");
    expect(cta).not.toHaveClass("bg-primary");
  });

  it("marks the current page with aria-current and leaves other links unmarked", () => {
    render(<SiteHeader currentPath="/privacy" />);
    expect(screen.getByRole("link", { name: "الخصوصية" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "الرئيسية" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "احجز موعداً" })).not.toHaveAttribute("aria-current");
  });

  it("exposes the mobile nav through a reachable sheet drawer", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    // Closed by default: the drawer's duplicate nav is not in the DOM at all
    // (Radix unmounts Presence children when `open` is false), so only the
    // desktop nav's anchors exist until the trigger is activated.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "افتح القائمة" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog");
    const mobileNav = within(dialog).getByRole("navigation", { name: "التنقل الرئيسي" });
    const mobileLinks = within(mobileNav).getAllByRole("link");
    expect(mobileLinks.map((link) => link.textContent)).toEqual([
      "الرئيسية",
      "الخصوصية",
      "الشروط",
      "احجز موعداً",
    ]);
    expect(within(dialog).getByRole("link", { name: "احجز موعداً" })).toHaveAttribute(
      "href",
      "/book",
    );
  });
});
