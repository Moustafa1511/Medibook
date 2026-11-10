"use client";

// "use client": fetches slots for the chosen day and handles slot selection.
import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LOCALE } from "@/lib/locale";
import { cn } from "@/lib/utils";

import { getDaySlots } from "../actions";
import type { SlotDto } from "../types";

interface TimeStepProps {
  serviceId: string;
  dateLocal: string;
  selectedStartUtcIso?: string;
  onSelect: (startUtcIso: string) => void;
  announce: (message: string) => void;
}

type Band = "morning" | "afternoon" | "evening";

const BAND_LABEL: Record<Band, string> = {
  morning: "صباحاً",
  afternoon: "بعد الظهر",
  evening: "مساءً",
};

const BANDS: readonly Band[] = ["morning", "afternoon", "evening"];

function bandFor(displayLocal: string): Band {
  const hour = Number(displayLocal.slice(0, 2));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** e.g. "الثلاثاء، 13 أكتوبر" — so a slot's accessible name stands alone. */
function longDate(dateLocal: string): string {
  return new Date(`${dateLocal}T12:00:00`).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function TimeStep({
  serviceId,
  dateLocal,
  selectedStartUtcIso,
  onSelect,
  announce,
}: TimeStepProps) {
  const [slots, setSlots] = useState<readonly SlotDto[]>([]);
  const [timeZone, setTimeZone] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await getDaySlots({ serviceId, dateLocal });
      if (result.ok) {
        setSlots(result.data.slots);
        setTimeZone(result.data.timeZone);
        announce(
          result.data.slots.length === 0
            ? "لا توجد مواعيد متاحة في هذا اليوم."
            : `${result.data.slots.length} موعد متاح.`,
        );
      } else {
        setSlots([]);
        setError(result.error.message);
        announce(result.error.message);
      }
    });
  }, [serviceId, dateLocal, announce]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden className="size-4" />
        <AlertTitle>تعذّر تحميل المواعيد المتاحة</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            حاول مرة أخرى
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isPending && slots.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-10 rounded-xl" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <p className="font-semibold">لا توجد مواعيد متاحة في {longDate(dateLocal)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          قد يكون آخر موعد قد تم حجزه للتو. من فضلك اختر يوماً آخر.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        المواعيد المعروضة ليوم {longDate(dateLocal)}
        {timeZone ? (
          <>
            {" "}
            بتوقيت العيادة (<span className="font-medium">{timeZone}</span>)
          </>
        ) : null}
        .
      </p>

      {BANDS.map((band) => {
        const inBand = slots.filter((slot) => bandFor(slot.displayLocal) === band);
        if (inBand.length === 0) return null;

        return (
          <section key={band} aria-labelledby={`band-${band}`}>
            <h3 id={`band-${band}`} className="mb-2 text-sm font-semibold">
              {BAND_LABEL[band]}
            </h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {inBand.map((slot) => {
                const isSelected = slot.startUtcIso === selectedStartUtcIso;
                return (
                  <li key={slot.startUtcIso}>
                    <button
                      type="button"
                      onClick={() => onSelect(slot.startUtcIso)}
                      aria-pressed={isSelected}
                      aria-label={`${slot.displayLocal}، ${longDate(dateLocal)}`}
                      className={cn(
                        "w-full rounded-xl border px-2 py-2 text-sm font-medium transition",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isSelected
                          ? "border-primary-button bg-primary-button text-primary-foreground"
                          : "border-border bg-card hover:border-primary",
                      )}
                    >
                      {/* Clock times stay in Latin digits, matching LOCALE's pinned
                          numeral system (see src/lib/locale.ts). */}
                      <span dir="ltr">{slot.displayLocal}</span>
                      {isSelected && <span className="sr-only"> (محدد)</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
