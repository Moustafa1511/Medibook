/**
 * The shared error vocabulary (C12, as amended by A4). Every Server Action
 * returns an ActionResult and never throws across the client boundary.
 *
 * `message` is always a safe, user-displayable string: no PII, no stack, no
 * internal detail (C12/C19).
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "SLOT_TAKEN",
  "SLOT_UNAVAILABLE",
  "HOLD_EXPIRED",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_MAX_ATTEMPTS",
  "OTP_RESEND_COOLDOWN",
  "OTP_SEND_FAILED",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "ACCOUNT_LOCKED",
  "INVALID_TRANSITION",
  "CLOSED_DAY",
  "OUTSIDE_BOOKING_WINDOW",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ActionError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
}

/** Default user-facing copy per code, so call sites need not invent wording. */
export const DEFAULT_ERROR_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  SLOT_TAKEN: "Sorry, someone just booked that time. Please choose another.",
  SLOT_UNAVAILABLE: "That time is no longer available. Please choose another.",
  HOLD_EXPIRED: "Your booking was not confirmed in time, so the slot was released.",
  OTP_INVALID: "That code is not correct. Please check and try again.",
  OTP_EXPIRED: "That code has expired. Please request a new one.",
  OTP_MAX_ATTEMPTS: "Too many incorrect codes. Please request a new one.",
  OTP_RESEND_COOLDOWN: "Please wait before requesting another code.",
  OTP_SEND_FAILED: "We could not send your code. Please try again.",
  NOT_FOUND: "We could not find what you were looking for.",
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You do not have access to that.",
  ACCOUNT_LOCKED: "This account is temporarily locked. Please try again later.",
  INVALID_TRANSITION: "That change is not allowed from the current status.",
  CLOSED_DAY: "The clinic is closed on that day.",
  OUTSIDE_BOOKING_WINDOW: "That date is outside the bookable window.",
  INTERNAL: "Something went wrong on our end. Please try again.",
};
