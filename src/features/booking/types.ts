import type { UnavailableDayReason } from "@/server/slots/types";

/** A service as shown in wizard step 1. */
export interface BookableService {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly durationMin: number;
  readonly priceMinor: number;
  readonly currency: string;
}

/**
 * Wire shapes. Dates cross the server/client boundary as ISO strings, never as
 * Date objects, which do not survive serialisation predictably.
 */
export interface DayAvailabilityDto {
  readonly dateLocal: string;
  readonly available: boolean;
  readonly reason?: UnavailableDayReason;
}

export interface SlotDto {
  readonly startUtcIso: string;
  readonly displayLocal: string;
}

export interface MonthAvailabilityData {
  readonly days: readonly DayAvailabilityDto[];
}

export interface DaySlotsData {
  readonly slots: readonly SlotDto[];
  /** The clinic's IANA zone, so the UI can label times unambiguously. */
  readonly timeZone: string;
}
