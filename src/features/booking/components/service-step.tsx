"use client";

// "use client": each card is a button with a selection handler.
import { Clock } from "lucide-react";

import { MoneyDisplay } from "@/components/money-display";
import { cn } from "@/lib/utils";

import type { BookableService } from "../types";

interface ServiceStepProps {
  services: readonly BookableService[];
  selectedServiceId?: string;
  onSelect: (serviceId: string) => void;
}

export function formatDuration(durationMin: number): string {
  if (durationMin < 60) return `${durationMin} دقيقة`;
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const hourLabel = hours === 1 ? "ساعة" : `${hours} ساعات`;
  return minutes === 0 ? hourLabel : `${hourLabel} و${minutes} دقيقة`;
}

export function ServiceStep({ services, selectedServiceId, onSelect }: ServiceStepProps) {
  if (services.length === 0) {
    return (
      <p className="text-muted-foreground">
        لا توجد خدمات متاحة للحجز حالياً. من فضلك اتصل بالعيادة.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => {
        const isSelected = service.id === selectedServiceId;
        return (
          <li key={service.id}>
            <button
              type="button"
              onClick={() => onSelect(service.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex h-full w-full flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-start shadow-soft transition",
                "hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isSelected ? "border-2 border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <span className="font-display text-lg font-semibold">{service.name}</span>
              <span className="text-sm text-muted-foreground">{service.description}</span>
              <span className="mt-auto flex w-full items-center justify-between pt-2">
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock aria-hidden className="size-4" />
                  {formatDuration(service.durationMin)}
                </span>
                <span className="font-semibold">
                  <MoneyDisplay minor={service.priceMinor} currency={service.currency} />
                </span>
              </span>
              {/* Selection is announced, not left to the border colour alone. */}
              {isSelected && <span className="sr-only">محددة</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
