import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MoneyDisplay } from "@/components/money-display";

describe("MoneyDisplay", () => {
  it("renders the formatted euro value for a 5000-minor-unit EUR amount", () => {
    render(<MoneyDisplay minor={5000} currency="EUR" locale="en-US" />);
    expect(screen.getByText("€50.00")).toBeInTheDocument();
  });

  it("delegates the minor-unit exponent to formatMoney instead of hardcoding /100 (0-digit JPY)", () => {
    // If MoneyDisplay ever hardcoded `/ 100` instead of calling formatMoney, 500 minor JPY
    // units would wrongly render as "¥5" instead of "¥500" (JPY has no minor unit).
    render(<MoneyDisplay minor={500} currency="JPY" locale="ja-JP" />);
    expect(screen.getByText("￥500")).toBeInTheDocument();
  });

  it("throws rather than silently rendering a fractional minor-unit amount", () => {
    expect(() => render(<MoneyDisplay minor={10.5} currency="EUR" locale="en-US" />)).toThrow(
      /integer minor-unit amount/,
    );
  });
});
