import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("component test harness", () => {
  it("renders a vendored primitive and exposes jest-dom matchers", () => {
    render(<Button>Book appointment</Button>);
    const button = screen.getByRole("button", { name: "Book appointment" });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });
});
