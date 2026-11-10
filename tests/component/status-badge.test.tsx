import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/status-badge";
import { APPOINTMENT_STATUS_VALUES } from "@/lib/enums";

describe("StatusBadge", () => {
  it("renders a pairwise-distinct text label for all 5 AppointmentStatus values", () => {
    const labels = APPOINTMENT_STATUS_VALUES.map((status) => {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const text = container.textContent ?? "";
      unmount();
      return text;
    });

    expect(labels).toHaveLength(5);
    // Every label is non-empty, and the set of 5 renders has 5 distinct members — i.e. no
    // two statuses render the same text, so a sighted-but-colorblind reader (or a plain
    // text dump, e.g. a screen reader) can still tell every status apart (C4, WCAG 1.4.1).
    for (const text of labels) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(5);
  });

  it("pairs every status with an icon, so color is never the only signal", () => {
    for (const status of APPOINTMENT_STATUS_VALUES) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const icon = container.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });

  it("never renders the status text itself in a status color (text stays text-foreground)", () => {
    const { container } = render(<StatusBadge status="CANCELLED" />);
    const badge = container.firstElementChild;
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("text-foreground");
    expect(badge?.className).not.toMatch(/\btext-destructive\b/);
  });
});
