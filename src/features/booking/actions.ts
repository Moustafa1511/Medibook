"use server";

import { systemClock } from "@/lib/clock";
import { DEFAULT_ERROR_MESSAGE, fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { getAvailableDays, getAvailableSlots } from "@/server/slots/availability";
import { SlotEngineError } from "@/server/slots/types";

import { daySlotsInput, monthAvailabilityInput } from "./schemas";
import type { DaySlotsData, MonthAvailabilityData } from "./types";

/**
 * Availability reads for the booking wizard.
 *
 * These two are written in exactly the shape the `defineAction` wrapper
 * (Section 5.1) will take — parse, then authorise, then handle, then map errors
 * — so folding them into that wrapper once it exists is mechanical. The wrapper
 * does not exist yet, which is why the pipeline is spelled out inline here.
 *
 * Rate limiting (C14: availability.read 60/min per IP) is applied by that same
 * wrapper and is therefore still outstanding; noted so it is not forgotten.
 */

function mapUnknownError(scope: string, error: unknown): ActionResult<never> {
  if (error instanceof SlotEngineError) {
    return fail(error.code, DEFAULT_ERROR_MESSAGE[error.code]);
  }
  // The error's own name/message is internal diagnostic text, never patient
  // data, so it is safe to log; the request input is deliberately NOT logged (C19).
  logger.error(
    {
      scope,
      err: error instanceof Error ? error.name : "unknown",
      detail: error instanceof Error ? error.message : String(error),
      at: error instanceof Error ? error.stack?.split("\n")[1]?.trim() : undefined,
    },
    "action failed",
  );
  return fail("INTERNAL", DEFAULT_ERROR_MESSAGE.INTERNAL);
}

async function serviceExists(serviceId: string): Promise<boolean> {
  const service = await db.service.findFirst({
    where: { id: serviceId, isActive: true },
    select: { id: true },
  });
  return service !== null;
}

export async function getMonthAvailability(
  input: unknown,
): Promise<ActionResult<MonthAvailabilityData>> {
  const parsed = monthAvailabilityInput.safeParse(input);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      DEFAULT_ERROR_MESSAGE.VALIDATION_ERROR,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    // The engine returns [] for an unknown or inactive service rather than
    // throwing, which would otherwise render as a silently empty calendar.
    if (!(await serviceExists(parsed.data.serviceId))) {
      return fail("NOT_FOUND", "That service is no longer offered.");
    }

    const days = await getAvailableDays({
      yearMonth: parsed.data.yearMonth,
      serviceId: parsed.data.serviceId,
      clock: systemClock,
    });

    return ok({
      days: days.map((day) =>
        day.available
          ? { dateLocal: day.dateLocal, available: true as const }
          : { dateLocal: day.dateLocal, available: false as const, reason: day.reason },
      ),
    });
  } catch (error) {
    return mapUnknownError("booking.getMonthAvailability", error);
  }
}

export async function getDaySlots(input: unknown): Promise<ActionResult<DaySlotsData>> {
  const parsed = daySlotsInput.safeParse(input);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      DEFAULT_ERROR_MESSAGE.VALIDATION_ERROR,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    if (!(await serviceExists(parsed.data.serviceId))) {
      return fail("NOT_FOUND", "That service is no longer offered.");
    }

    const [slots, settings] = await Promise.all([
      getAvailableSlots({
        dateLocal: parsed.data.dateLocal,
        serviceId: parsed.data.serviceId,
        clock: systemClock,
      }),
      db.clinicSettings.findUnique({ where: { id: "singleton" }, select: { timeZone: true } }),
    ]);

    return ok({
      slots: slots.map((slot) => ({
        startUtcIso: slot.startUtc.toISOString(),
        displayLocal: slot.displayLocal,
      })),
      timeZone: settings?.timeZone ?? "UTC",
    });
  } catch (error) {
    return mapUnknownError("booking.getDaySlots", error);
  }
}
