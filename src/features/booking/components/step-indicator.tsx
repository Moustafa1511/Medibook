import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const BOOKING_STEPS = [
  { number: 1, label: "الخدمة" },
  { number: 2, label: "التاريخ" },
  { number: 3, label: "الوقت" },
  { number: 4, label: "بياناتك" },
  { number: 5, label: "التأكيد" },
] as const;

/** Steps 4 and 5 exist in the UI but are not yet implemented (Phase 5 tasks). */
export const IMPLEMENTED_THROUGH_STEP = 3;

interface StepIndicatorProps {
  current: number;
}

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <nav aria-label="مراحل الحجز">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-4">
        {BOOKING_STEPS.map((step) => {
          const isDone = step.number < current;
          const isCurrent = step.number === current;
          const isFuture = step.number > current;
          const notYetBuilt = step.number > IMPLEMENTED_THROUGH_STEP;

          return (
            <li key={step.number} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  isDone && "border-primary-button bg-primary-button text-primary-foreground",
                  isCurrent && "border-2 border-primary bg-card text-primary",
                  isFuture && "border-border bg-card text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-4" /> : step.number}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
                {/* Spelled out rather than implied by styling, so the status is
                    available to a screen reader too. */}
                {notYetBuilt && <span className="sr-only"> (غير متاحة بعد)</span>}
                {isDone && <span className="sr-only"> (مكتملة)</span>}
                {isCurrent && <span className="sr-only"> (المرحلة الحالية)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
