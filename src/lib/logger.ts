import { createHmac } from "node:crypto";

import pino, { type DestinationStream, type Logger } from "pino";

import { env } from "@/lib/env";

/**
 * The one logger (C19). Patient-identifying fields are redacted by the
 * serializer rather than by the discipline of each call site, because one
 * forgotten field in one log line is a privacy incident.
 *
 * Never logged: phone numbers, full names, OTP codes, passwords, session
 * tokens, booking references, raw request bodies.
 * Logged instead: appointmentId, serviceId, requestId, and phoneHash().
 */
const REDACTED_FIELDS = [
  "phoneE164",
  "holdPhoneE164",
  "phone",
  "fullName",
  "holdFullName",
  "name",
  "code",
  "otp",
  "password",
  "passwordHash",
  "sessionToken",
  "token",
  "reference",
  "authorization",
  "cookie",
  "body",
] as const;

/** Cover the field at the root and at the first two levels of nesting. */
const REDACT_PATHS = REDACTED_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]);

export function createLogger(destination?: DestinationStream): Logger {
  const options = {
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: "[redacted]",
    },
    base: undefined,
  } satisfies pino.LoggerOptions;

  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

/**
 * Stable, non-reversible correlation handle for a phone number (C19): the first
 * 8 hex characters of HMAC-SHA256(phone, OTP_PEPPER). Lets two log lines be tied
 * to the same patient without the number ever reaching the log.
 *
 * Rotating OTP_PEPPER breaks correlation with historical logs by design.
 */
export function phoneHash(phoneE164: string): string {
  return createHmac("sha256", env.OTP_PEPPER).update(phoneE164).digest("hex").slice(0, 8);
}
