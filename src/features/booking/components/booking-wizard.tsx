"use client";

// "use client": owns the wizard reducer, focus management and sessionStorage.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DateStep } from "./date-step";
import { ServiceStep } from "./service-step";
import { IMPLEMENTED_THROUGH_STEP, StepIndicator } from "./step-indicator";
import { TimeStep } from "./time-step";
import type { BookableService } from "../types";

const DRAFT_KEY = "medibook.booking.draft.v1";

interface WizardState {
  step: number;
  serviceId?: string;
  dateLocal?: string;
  startUtcIso?: string;
}

type WizardAction =
  | { type: "SELECT_SERVICE"; serviceId: string }
  | { type: "SELECT_DATE"; dateLocal: string }
  | { type: "SELECT_SLOT"; startUtcIso: string }
  | { type: "BACK" }
  | { type: "RESTORE"; state: WizardState };

/**
 * Choosing something earlier in the flow invalidates everything downstream: a
 * different service has a different duration, so a previously chosen date and
 * slot may no longer be bookable. Clearing them here is what stops a stale slot
 * surviving into the later steps.
 */
function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SELECT_SERVICE":
      return state.serviceId === action.serviceId
        ? { ...state, step: 2 }
        : { step: 2, serviceId: action.serviceId };
    case "SELECT_DATE":
      return state.dateLocal === action.dateLocal
        ? { ...state, step: 3 }
        : { ...state, step: 3, dateLocal: action.dateLocal, startUtcIso: undefined };
    case "SELECT_SLOT":
      return { ...state, startUtcIso: action.startUtcIso };
    case "BACK":
      return { ...state, step: Math.max(1, state.step - 1) };
    case "RESTORE":
      return action.state;
    default:
      return state;
  }
}

const STEP_HEADINGS: Record<number, string> = {
  1: "اختر الخدمة",
  2: "اختر التاريخ",
  3: "اختر الوقت",
};

interface BookingWizardProps {
  services: readonly BookableService[];
}

export function BookingWizard({ services }: BookingWizardProps) {
  const [state, dispatch] = useReducer(reducer, { step: 1 });
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasRestored = useRef(false);
  const previousStep = useRef(state.step);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  // Restore a draft once, so a refresh mid-booking is not punished. Storage
  // throws in private mode, so every access is guarded.
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as WizardState;
      // Only trust a service that still exists; a restored slot is deliberately
      // dropped and re-validated by refetching, never trusted from storage.
      if (parsed.serviceId && services.some((service) => service.id === parsed.serviceId)) {
        dispatch({
          type: "RESTORE",
          state: {
            step: parsed.dateLocal ? 3 : 2,
            serviceId: parsed.serviceId,
            dateLocal: parsed.dateLocal,
          },
        });
      }
    } catch {
      // Unreadable or disabled storage is not an error worth surfacing.
    }
  }, [services]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Ignore: the wizard works without persistence.
    }
  }, [state]);

  // Moving focus to the new step's heading is what announces the step change:
  // a screen reader reads the focused heading. The live region below is
  // deliberately NOT used for this — DateStep/TimeStep immediately replace its
  // contents with their own loading/result status, which would clobber a step
  // message before it was ever read out.
  useEffect(() => {
    if (previousStep.current !== state.step) {
      previousStep.current = state.step;
      headingRef.current?.focus();
    }
  }, [state.step]);

  const selectedService = services.find((service) => service.id === state.serviceId);

  return (
    <div className="space-y-8">
      <StepIndicator current={state.step} />

      {/* Single live region for async status: loading, counts and errors. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <div className="space-y-4">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold outline-none"
        >
          {STEP_HEADINGS[state.step] ?? "الحجز"}
        </h2>

        {selectedService && state.step > 1 && (
          <p className="text-sm text-muted-foreground">
            {selectedService.name}
            {state.dateLocal && state.step > 2 ? ` · ${state.dateLocal}` : ""}
          </p>
        )}

        {state.step === 1 && (
          <ServiceStep
            services={services}
            selectedServiceId={state.serviceId}
            onSelect={(serviceId) => dispatch({ type: "SELECT_SERVICE", serviceId })}
          />
        )}

        {state.step === 2 && state.serviceId && (
          <DateStep
            serviceId={state.serviceId}
            selectedDate={state.dateLocal}
            onSelect={(dateLocal) => dispatch({ type: "SELECT_DATE", dateLocal })}
            announce={announce}
          />
        )}

        {state.step === 3 && state.serviceId && state.dateLocal && (
          <>
            <TimeStep
              serviceId={state.serviceId}
              dateLocal={state.dateLocal}
              selectedStartUtcIso={state.startUtcIso}
              onSelect={(startUtcIso) => dispatch({ type: "SELECT_SLOT", startUtcIso })}
              announce={announce}
            />
            {state.startUtcIso && (
              <div className="mt-6 rounded-2xl border bg-card p-4 shadow-soft">
                <p className="font-semibold">تم اختيار الموعد</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  المرحلتان {IMPLEMENTED_THROUGH_STEP + 1} و 5 — بياناتك وتأكيد الحجز — ما زالتا قيد
                  التطوير. من فضلك اتصل بالعيادة لإتمام الحجز.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {state.step > 1 && (
        <Button type="button" variant="outline" onClick={() => dispatch({ type: "BACK" })}>
          {/* The arrow means "back", so it must point the other way in RTL. */}
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          رجوع
        </Button>
      )}
    </div>
  );
}
