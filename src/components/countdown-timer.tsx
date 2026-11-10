"use client"; // Ticks on an interval and reads the wall clock to recompute the
// remaining time every second, re-rendering as it goes — none of that exists during
// server rendering.

import * as React from "react";

import { cn } from "@/lib/utils";

export interface CountdownTimerProps {
  /** The instant the countdown reaches zero — a `Date`, or epoch milliseconds. */
  target: Date | number;
  /** Called exactly once, when the countdown reaches zero. */
  onComplete?: () => void;
  className?: string;
}

function toTargetMs(target: Date | number): number {
  return typeof target === "number" ? target : target.getTime();
}

function msUntil(targetMs: number): number {
  return Math.max(0, targetMs - Date.now());
}

function formatMmSs(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Renders a `mm:ss` countdown to `target` and calls `onComplete` once it reaches
 * zero — built to back the OTP resend cooldown (Phase 6), so it is driven from a
 * fixed target instant rather than a decrementing counter: every tick recomputes
 * `target - Date.now()` from scratch, so a backgrounded or throttled tab can only
 * delay the next render, never desynchronize the displayed value from the real
 * deadline.
 *
 * Uses `role="timer"` with `aria-live="off"` deliberately: the per-second countdown
 * itself is not announced to assistive tech (that would be read aloud every second).
 * Only the terminal "reached zero" transition matters, and the consumer announces
 * that itself via `onComplete` (e.g. the OTP screen's own "code available" copy) —
 * this generic primitive doesn't hardcode that wording.
 *
 * No animation of any kind, so it respects `prefers-reduced-motion` by construction
 * — only the number itself changes.
 */
export function CountdownTimer({ target, onComplete, className }: CountdownTimerProps) {
  const targetMs = toTargetMs(target);
  const [remainingMs, setRemainingMs] = React.useState(() => msUntil(targetMs));
  const completedRef = React.useRef(false);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    completedRef.current = false;
    setRemainingMs(msUntil(targetMs));

    const intervalId = setInterval(() => {
      const next = msUntil(targetMs);
      setRemainingMs(next);
      if (next <= 0 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(intervalId);
        onCompleteRef.current?.();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [targetMs]);

  return (
    <span role="timer" aria-live="off" className={cn("tabular-nums", className)}>
      {formatMmSs(remainingMs)}
    </span>
  );
}
