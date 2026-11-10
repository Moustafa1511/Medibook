import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateRangePicker, type DateRange } from "@/components/date-range-picker";

function getDayButtons() {
  // ui/calendar's DayButton stamps data-day on every day's <button> (react-
  // day-picker separately stamps its own data-day, in a different format,
  // on the enclosing <td> gridcell - "button[data-day]" is what picks out
  // just the clickable elements, in chronological document order).
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-day]"));
}

describe("DateRangePicker", () => {
  it("calls onChange exactly once, only once a full range is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DateRangePicker value={null} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Pick a date range" }));

    const dayButtons = await waitFor(() => {
      const buttons = getDayButtons();
      expect(buttons.length).toBeGreaterThan(20);
      return buttons;
    });

    // Index 10/15 are always inside the displayed month's real days: a
    // calendar grid has at most 6 leading outside-month cells, so by index
    // 10 we are safely past them regardless of which month is showing.
    const firstDayAttr = dayButtons[10]!.dataset.day!;
    const secondDayAttr = dayButtons[15]!.dataset.day!;

    await user.click(dayButtons[10]!);
    // One end of the range picked is not a complete selection yet.
    expect(onChange).not.toHaveBeenCalled();

    // Selecting the first day re-renders the grid with fresh DOM nodes (the
    // calendar remounts its day cells on every selection change), so the
    // second day must be re-queried rather than clicked via a now-detached
    // reference from before that render.
    const secondButton = await waitFor(() => {
      const button = document.querySelector<HTMLButtonElement>(
        `button[data-day="${secondDayAttr}"]`,
      );
      expect(button).not.toBeNull();
      return button!;
    });
    await user.click(secondButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const reported = onChange.mock.calls[0]?.[0] as DateRange;
    expect(reported.from.toLocaleDateString()).toBe(firstDayAttr);
    expect(reported.to.toLocaleDateString()).toBe(secondDayAttr);
  });

  it("never mutates the value prop it was given", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const initialValue: DateRange = {
      from: new Date(2026, 0, 5),
      to: new Date(2026, 0, 7),
    };
    const originalFromTime = initialValue.from.getTime();
    const originalToTime = initialValue.to.getTime();

    render(<DateRangePicker value={initialValue} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /2026/ }));

    const dayButtons = await waitFor(() => {
      const buttons = getDayButtons();
      expect(buttons.length).toBeGreaterThan(20);
      return buttons;
    });

    // A day comfortably past the existing range's end: ui/calendar extends
    // the current selection to it in a single click, which is exactly the
    // moment a mutation of the caller's `value` would be easiest to slip in.
    const target = dayButtons[dayButtons.length - 3]!;
    await user.click(target);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const reported = onChange.mock.calls[0]?.[0] as DateRange;

    expect(reported).not.toBe(initialValue);
    expect(reported.from).not.toBe(initialValue.from);
    expect(reported.to).not.toBe(initialValue.to);
    expect(initialValue.from.getTime()).toBe(originalFromTime);
    expect(initialValue.to.getTime()).toBe(originalToTime);
  });

  it("renders the placeholder when no value is given", () => {
    render(<DateRangePicker value={null} onChange={vi.fn()} placeholder="Pick a date range" />);
    expect(screen.getByRole("button", { name: "Pick a date range" })).toBeInTheDocument();
  });
});
