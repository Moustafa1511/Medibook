"use client";
// Owns whether the popover is open and the in-progress (not yet committed)
// click-sequence state (useState), and wires react-day-picker's
// range-selection callback - all client-only (8.2.13(b)/(c)).

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange as CalendarDateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
  align?: "start" | "end";
  placeholder?: string;
  className?: string;
}

/**
 * Presentation-only range picker over `ui/popover` + `ui/calendar` (8.2.12).
 * `value` is the only source of truth for what is *committed*; this
 * component never writes into it, and never reports a selection until the
 * user has picked two distinct days. The dashboard and appointments filters
 * each own their own URL-sync wrapper around this.
 *
 * Picking a range is inherently a two-click gesture (start day, then end
 * day), and `value` can only express a *complete* range - so the first
 * click's result has nowhere to live if this component doesn't hold it
 * itself. `draftRange` is exactly that: transient, uncommitted click-sequence
 * state, reset from `value` each time the popover opens. It is never
 * mutated in place - react-day-picker's `onSelect` always hands back a new
 * object, and so does the `onChange` call built from it - only ever
 * replaced wholesale, so `value` itself is never written into.
 */
export function DateRangePicker({
  value,
  onChange,
  align = "start",
  placeholder = "Pick a date range",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draftRange, setDraftRange] = React.useState<CalendarDateRange | undefined>(
    value ?? undefined,
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      // Start every opening from the last committed value - any
      // uncompleted click sequence left over from a previous opening (e.g.
      // the user picked a start day, then dismissed the popover) is
      // discarded rather than resumed.
      setDraftRange(value ?? undefined);
    }
    setOpen(next);
  }

  function handleSelect(range: CalendarDateRange | undefined) {
    setDraftRange(range);
    // Only report upward, and only close, once both ends of the range are
    // picked - a single click's { from, to: undefined } is not yet a
    // complete selection (ui/calendar is configured with min={1} so a
    // single click never counts as one either).
    if (range?.from && range?.to) {
      // addToRange (inside react-day-picker) reuses whichever Date
      // instance was already the range's `from` or `to` rather than
      // cloning it - when that instance came from `value`, handing it
      // onward as-is would leak an alias of the caller's own Date object
      // into onChange. Cloning here guarantees the caller always gets
      // Dates it can own independently of `value`.
      onChange({ from: new Date(range.from), to: new Date(range.to) });
      setOpen(false);
    }
  }

  const label = value
    ? `${value.from.toLocaleDateString()} - ${value.to.toLocaleDateString()}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "justify-start text-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="range"
          defaultMonth={draftRange?.from ?? value?.from}
          selected={draftRange}
          onSelect={handleSelect}
          // react-day-picker's range selection defaults to min=0, which
          // treats a single click as an already-complete one-day range -
          // that would report and close before the user ever gets to pick
          // a second day. min=1 keeps the first click's result at
          // { from, to: undefined } so a real two-ended range requires two
          // different days, matching what "a range" means here.
          min={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
