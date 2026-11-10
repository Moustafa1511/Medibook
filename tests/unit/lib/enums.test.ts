import { describe, expect, it } from "vitest";

import {
  ADMIN_ROLE_VALUES,
  AdminRole,
  adminRoleSchema,
  APPOINTMENT_STATUS_TRANSITIONS,
  APPOINTMENT_STATUS_VALUES,
  AppointmentStatus,
  appointmentStatusSchema,
  AUDIT_ACTION_VALUES,
  AuditAction,
  auditActionSchema,
  BOOKING_SOURCE_VALUES,
  BookingSource,
  bookingSourceSchema,
} from "@/lib/enums";

describe("AppointmentStatus (C4)", () => {
  const expected = ["PENDING_VERIFICATION", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

  it("the runtime values array equals C4's literal list, in order", () => {
    expect([...APPOINTMENT_STATUS_VALUES]).toEqual(expected);
  });

  it("the const object exposes exactly the same members", () => {
    expect(Object.values(AppointmentStatus)).toEqual(expected);
    expect(Object.keys(AppointmentStatus)).toEqual(expected);
  });

  it("the Zod union accepts exactly the C4 members", () => {
    for (const value of expected) {
      expect(appointmentStatusSchema.safeParse(value).success).toBe(true);
    }
  });

  it("the Zod union rejects an outsider", () => {
    expect(appointmentStatusSchema.safeParse("REFUNDED").success).toBe(false);
    expect(appointmentStatusSchema.safeParse("").success).toBe(false);
    expect(appointmentStatusSchema.safeParse("confirmed").success).toBe(false); // case-sensitive
  });
});

describe("APPOINTMENT_STATUS_TRANSITIONS (C4's legal-transition map, as data)", () => {
  it("matches C4's six legal edges exactly", () => {
    expect(APPOINTMENT_STATUS_TRANSITIONS.get(AppointmentStatus.PENDING_VERIFICATION)).toEqual([
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CANCELLED,
    ]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.get(AppointmentStatus.CONFIRMED)).toEqual([
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ]);
  });

  it("treats COMPLETED, CANCELLED and NO_SHOW as terminal (no outbound transitions)", () => {
    expect(APPOINTMENT_STATUS_TRANSITIONS.get(AppointmentStatus.COMPLETED)).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.get(AppointmentStatus.CANCELLED)).toEqual([]);
    expect(APPOINTMENT_STATUS_TRANSITIONS.get(AppointmentStatus.NO_SHOW)).toEqual([]);
  });

  it("has an entry for every status and no stray keys, and sums to exactly 6 legal edges", () => {
    expect([...APPOINTMENT_STATUS_TRANSITIONS.keys()].sort()).toEqual(
      [...APPOINTMENT_STATUS_VALUES].sort(),
    );
    const totalEdges = [...APPOINTMENT_STATUS_TRANSITIONS.values()].reduce(
      (sum, tos) => sum + tos.length,
      0,
    );
    expect(totalEdges).toBe(6);
  });
});

describe("BookingSource (C4)", () => {
  const expected = ["WEB", "ADMIN", "PHONE"];

  it("the runtime values array equals C4's literal list, in order", () => {
    expect([...BOOKING_SOURCE_VALUES]).toEqual(expected);
  });

  it("the const object exposes exactly the same members", () => {
    expect(Object.values(BookingSource)).toEqual(expected);
  });

  it("the Zod union accepts exactly the C4 members and rejects an outsider", () => {
    for (const value of expected) {
      expect(bookingSourceSchema.safeParse(value).success).toBe(true);
    }
    expect(bookingSourceSchema.safeParse("API").success).toBe(false);
  });
});

describe("AdminRole (C4)", () => {
  const expected = ["OWNER", "STAFF"];

  it("the runtime values array equals C4's literal list, in order", () => {
    expect([...ADMIN_ROLE_VALUES]).toEqual(expected);
  });

  it("the const object exposes exactly the same members", () => {
    expect(Object.values(AdminRole)).toEqual(expected);
  });

  it("the Zod union accepts exactly the C4 members and rejects an outsider", () => {
    for (const value of expected) {
      expect(adminRoleSchema.safeParse(value).success).toBe(true);
    }
    expect(adminRoleSchema.safeParse("SUPERADMIN").success).toBe(false);
  });
});

describe("AuditAction (C4 as amended by A1)", () => {
  const c4Original = [
    "APPOINTMENT_STATUS_CHANGED",
    "APPOINTMENT_RESCHEDULED",
    "APPOINTMENT_CREATED_BY_ADMIN",
    "SERVICE_CREATED",
    "SERVICE_UPDATED",
    "SERVICE_DEACTIVATED",
    "SETTINGS_UPDATED",
    "CLOSED_DATE_ADDED",
    "CLOSED_DATE_REMOVED",
    "ADMIN_LOGIN_SUCCEEDED",
    "ADMIN_LOGIN_FAILED",
  ];
  const a1Additions = ["SERVICE_REACTIVATED", "ADMIN_LOGGED_OUT"];

  it("includes every C4-original member", () => {
    for (const value of c4Original) {
      expect(AUDIT_ACTION_VALUES).toContain(value);
    }
  });

  it("includes both A1 additions (SERVICE_REACTIVATED, ADMIN_LOGGED_OUT)", () => {
    for (const value of a1Additions) {
      expect(AUDIT_ACTION_VALUES).toContain(value);
    }
  });

  it("has exactly 13 members — the 11 from C4 plus A1's 2 additions, no more, no less", () => {
    expect(AUDIT_ACTION_VALUES).toHaveLength(13);
    expect([...AUDIT_ACTION_VALUES].sort()).toEqual([...c4Original, ...a1Additions].sort());
  });

  it("the const object exposes exactly the same members as the values array", () => {
    expect(Object.values(AuditAction).sort()).toEqual([...AUDIT_ACTION_VALUES].sort());
  });

  it("the Zod union accepts every member, including both A1 additions", () => {
    for (const value of AUDIT_ACTION_VALUES) {
      expect(auditActionSchema.safeParse(value).success).toBe(true);
    }
  });

  it("the Zod union rejects an outsider", () => {
    expect(auditActionSchema.safeParse("PATIENT_RECORD_DELETED").success).toBe(false);
  });
});
