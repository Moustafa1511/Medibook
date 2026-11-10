import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CountdownTimer } from "@/components/countdown-timer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the initial remaining time as mm:ss", () => {
    render(<CountdownTimer target={Date.now() + 5000} />);
    expect(screen.getByRole("timer")).toHaveTextContent("0:05");
  });

  it("ticks down a fake-timer second without drifting from the target instant", () => {
    render(<CountdownTimer target={Date.now() + 5000} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("0:04");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("0:03");
  });

  it("reaches 0:00 and calls onComplete exactly once, then stops ticking", () => {
    const onComplete = vi.fn();
    render(<CountdownTimer target={Date.now() + 2000} onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
  });

  it("clears its interval on unmount (no further timer callbacks fire)", () => {
    const onComplete = vi.fn();
    const { unmount } = render(
      <CountdownTimer target={Date.now() + 1000} onComplete={onComplete} />,
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("uses role=timer with aria-live=off — the per-second tick is not announced", () => {
    render(<CountdownTimer target={Date.now() + 5000} />);
    expect(screen.getByRole("timer")).toHaveAttribute("aria-live", "off");
  });
});
