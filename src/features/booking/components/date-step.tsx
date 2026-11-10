"use client";

// "use client": controlled calendar state, month navigation and data fetching.
import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnavailableDayReason } from "@/server/slots/types";

import { getMonthAvailability } from "../actions";
import type { DayAvailabilityDto } from "../types";

/** Local calendar date as "YYYY-MM-DD". Never via toISOString(), which shifts by the UTC offset. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Patient-facing Arabic wording for each reason the engine can return. */
const REASON_LABEL: Record<UnavailableDayReason, string> = {
  PAST: "تواريخ مضت",
  BEYOND_WINDOW: "أبعد من المدة المتاحة للحجز",
  CLOSED_DATE: "عطلة رسمية",
  NO_WORKING_HOURS: "يوم إغلاق العيادة (الجمعة)",
  LEAD_TIME: "قريب جداً للحجز عبر الإنترنت",
  FULLY_BOOKED: "مكتمل الحجز",
};

interface DateStepProps {
  serviceId: string;
  selectedDate?: string;
  onSelect: (dateLocal: string) => void;
  announce: (message: string) => void;
}

export function DateStep({ serviceId, selectedDate, onSelect, announce }: DateStepProps) {
  const [month, setMonth] = useState<Date>(() =>
    selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(),
  );
  const [days, setDays] = useState<readonly DayAvailabilityDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(
    (target: Date) => {
      setError(null);
      startTransition(async () => {
        const result = await getMonthAvailability({ serviceId, yearMonth: toMonthKey(target) });
        if (result.ok) {
          setDays(result.data.days);
          const open = result.data.days.filter((day) => day.available).length;
          announce(`${open} يوم متاح في هذا الشهر.`);
        } else {
          setDays([]);
          setError(result.error.message);
          announce(result.error.message);
        }
      });
    },
    [serviceId, announce],
  );

  useEffect(() => {
    load(month);
  }, [load, month]);

  const byDate = new Map(days.map((day) => [day.dateLocal, day]));
  const isUnavailable = (date: Date) => {
    const entry = byDate.get(toDateKey(date));
    // A day outside the fetched month is not selectable until its month loads.
    return entry ? !entry.available : true;
  };

  const reasonsPresent = [
    ...new Set(
      days
        .filter((day) => !day.available && day.reason)
        .map((day) => day.reason as UnavailableDayReason),
    ),
  ];

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden className="size-4" />
        <AlertTitle>تعذّر تحميل التقويم</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => load(month)}>
            حاول مرة أخرى
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="rounded-2xl border bg-card p-2 shadow-soft">
        {isPending && days.length === 0 ? (
          <Skeleton className="h-[21rem] w-[18rem]" />
        ) : (
          <Calendar
            mode="single"
            dir="rtl"
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate ? new Date(`${selectedDate}T12:00:00`) : undefined}
            onSelect={(date) => {
              if (!date) return;
              onSelect(toDateKey(date));
            }}
            disabled={isUnavailable}
            showOutsideDays={false}
            aria-busy={isPending}
          />
        )}
      </div>

      <div className="flex-1 space-y-3">
        <h3 className="text-sm font-semibold">أسباب عدم توفّر بعض الأيام</h3>
        {reasonsPresent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "جارٍ التحقق من المواعيد المتاحة…"
              : "كل الأيام المتاحة هذا الشهر بها مواعيد."}
          </p>
        ) : (
          <ul className="space-y-1">
            {reasonsPresent.map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-muted" />
                <span>الأيام غير المتاحة قد تكون: {REASON_LABEL[reason]}.</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          استخدم مفاتيح الأسهم للتنقل داخل التقويم، أو الأسهم بالأعلى لتغيير الشهر.
        </p>
      </div>
    </div>
  );
}
