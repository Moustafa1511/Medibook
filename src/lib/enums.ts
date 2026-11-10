/**
 * Canonical enum vocabulary (C4, AS AMENDED BY A1). Every enum-like column in the DB is
 * a plain `String` (C3: no Prisma enums, so SQLite stays viable), validated at every
 * boundary by the Zod unions here. These are the single source of truth; nothing else in
 * the repo should re-declare these literal lists.
 *
 * Each enum follows one shape: a `*_VALUES` tuple (the literal source of truth), a Zod
 * schema derived from it, an inferred type, and a const object for ergonomic dotted
 * access (`AppointmentStatus.CONFIRMED`) whose `satisfies` clause makes the type checker
 * reject a missing, extra, or mismatched key if the tuple ever changes.
 */

import { z } from "zod";

// ---------------------------------------------------------------- AppointmentStatus

export const APPOINTMENT_STATUS_VALUES = [
  "PENDING_VERIFICATION",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUS_VALUES);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const AppointmentStatus = {
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const satisfies { [K in AppointmentStatus]: K };

/**
 * Legal AppointmentStatus transitions (C4), as DATA ONLY. The enforcement function —
 * the one place that actually checks a transition against this map and throws
 * `INVALID_TRANSITION` otherwise — lives in `src/server/appointments/transitions.ts`
 * (Phase 4), not here; this module stays pure and Prisma-free.
 *
 * Keyed by the "from" status; the value is every legal "to" status, including the
 * `CONFIRMED -> CONFIRMED` self-transition (a reschedule, which moves slots inside one
 * transaction without changing status). `COMPLETED`, `CANCELLED` and `NO_SHOW` are
 * terminal: no outbound transitions, hence the empty arrays.
 */
export const APPOINTMENT_STATUS_TRANSITIONS: ReadonlyMap<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = new Map([
  [
    AppointmentStatus.PENDING_VERIFICATION,
    [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  ],
  [
    AppointmentStatus.CONFIRMED,
    [
      AppointmentStatus.CONFIRMED, // reschedule: moves slots inside one transaction
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ],
  ],
  [AppointmentStatus.COMPLETED, []],
  [AppointmentStatus.CANCELLED, []],
  [AppointmentStatus.NO_SHOW, []],
]);

// ------------------------------------------------------------------- BookingSource

export const BOOKING_SOURCE_VALUES = ["WEB", "ADMIN", "PHONE"] as const;

export const bookingSourceSchema = z.enum(BOOKING_SOURCE_VALUES);

export type BookingSource = z.infer<typeof bookingSourceSchema>;

export const BookingSource = {
  WEB: "WEB",
  ADMIN: "ADMIN",
  PHONE: "PHONE",
} as const satisfies { [K in BookingSource]: K };

// ---------------------------------------------------------------------- AdminRole

export const ADMIN_ROLE_VALUES = ["OWNER", "STAFF"] as const;

export const adminRoleSchema = z.enum(ADMIN_ROLE_VALUES);

export type AdminRole = z.infer<typeof adminRoleSchema>;

export const AdminRole = {
  OWNER: "OWNER",
  STAFF: "STAFF",
} as const satisfies { [K in AdminRole]: K };

// -------------------------------------------------------------------- AuditAction

/**
 * C4's original list plus A1's two additions (`SERVICE_REACTIVATED`,
 * `ADMIN_LOGGED_OUT`), placed next to the counter-operation each pairs with so every
 * state-changing admin operation has a logged opposite (A1's own rationale).
 */
export const AUDIT_ACTION_VALUES = [
  "APPOINTMENT_STATUS_CHANGED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CREATED_BY_ADMIN",
  "SERVICE_CREATED",
  "SERVICE_UPDATED",
  "SERVICE_DEACTIVATED",
  "SERVICE_REACTIVATED", // A1
  "SETTINGS_UPDATED",
  "CLOSED_DATE_ADDED",
  "CLOSED_DATE_REMOVED",
  "ADMIN_LOGIN_SUCCEEDED",
  "ADMIN_LOGIN_FAILED",
  "ADMIN_LOGGED_OUT", // A1
] as const;

export const auditActionSchema = z.enum(AUDIT_ACTION_VALUES);

export type AuditAction = z.infer<typeof auditActionSchema>;

export const AuditAction = {
  APPOINTMENT_STATUS_CHANGED: "APPOINTMENT_STATUS_CHANGED",
  APPOINTMENT_RESCHEDULED: "APPOINTMENT_RESCHEDULED",
  APPOINTMENT_CREATED_BY_ADMIN: "APPOINTMENT_CREATED_BY_ADMIN",
  SERVICE_CREATED: "SERVICE_CREATED",
  SERVICE_UPDATED: "SERVICE_UPDATED",
  SERVICE_DEACTIVATED: "SERVICE_DEACTIVATED",
  SERVICE_REACTIVATED: "SERVICE_REACTIVATED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  CLOSED_DATE_ADDED: "CLOSED_DATE_ADDED",
  CLOSED_DATE_REMOVED: "CLOSED_DATE_REMOVED",
  ADMIN_LOGIN_SUCCEEDED: "ADMIN_LOGIN_SUCCEEDED",
  ADMIN_LOGIN_FAILED: "ADMIN_LOGIN_FAILED",
  ADMIN_LOGGED_OUT: "ADMIN_LOGGED_OUT",
} as const satisfies { [K in AuditAction]: K };
