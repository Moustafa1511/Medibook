import { z } from "zod";

/**
 * The single sanctioned reader of process.env (C16). Every other module imports
 * `env` from here; an ESLint `no-restricted-syntax` rule enforces that and
 * exempts only this file.
 *
 * Server-side by design: this object carries secrets. Client components must not
 * import it — use a NEXT_PUBLIC_* value directly instead.
 */

const booleanFromString = z.enum(["true", "false"]).transform((value) => value === "true");

const ianaTimeZone = z.string().min(1).refine(isValidTimeZone, {
  message: "must be a valid IANA time zone, e.g. Europe/Berlin",
});

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const baseSchema = z.object({
  // --- database -------------------------------------------------------------
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),

  // --- auth -----------------------------------------------------------------
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  AUTH_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // --- secrets --------------------------------------------------------------
  OTP_PEPPER: z.string().min(32, "must be at least 32 characters"),
  CRON_SECRET: z.string().min(16, "must be at least 16 characters"),

  // --- SMS ------------------------------------------------------------------
  SMS_PROVIDER: z.enum(["console", "twilio"]),
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  TWILIO_MESSAGING_SERVICE_SID: z.string().default(""),
  TWILIO_FROM_NUMBER: z.string().default(""),
  SMS_DAILY_CAP_MINOR: z.coerce.number().int().nonnegative(),
  SMS_KILL_SWITCH: booleanFromString,

  // --- rate limiting --------------------------------------------------------
  RATE_LIMIT_PROVIDER: z.enum(["memory", "upstash"]),
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),

  // --- clinic ---------------------------------------------------------------
  CLINIC_TIMEZONE: ianaTimeZone,
  CLINIC_CURRENCY: z.string().regex(/^[A-Z]{3}$/, "must be an ISO-4217 code, e.g. EUR"),
  CLINIC_DEFAULT_COUNTRY: z
    .string()
    .regex(/^[A-Z]{2}$/, "must be an ISO-3166-1 alpha-2 code, e.g. DE"),

  // --- seed + ops -----------------------------------------------------------
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(8, "must be at least 8 characters"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  E2E_TEST_HOOKS: booleanFromString,
});

/**
 * Conditional requirements: the Twilio and Upstash credentials are only
 * mandatory once their provider is actually selected, so a console/memory
 * development setup needs no vendor accounts.
 */
const envSchema = baseSchema.superRefine((value, ctx) => {
  if (value.SMS_PROVIDER === "twilio") {
    if (!value.TWILIO_ACCOUNT_SID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_ACCOUNT_SID"],
        message: 'is required when SMS_PROVIDER is "twilio"',
      });
    }
    if (!value.TWILIO_AUTH_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_AUTH_TOKEN"],
        message: 'is required when SMS_PROVIDER is "twilio"',
      });
    }
    if (!value.TWILIO_MESSAGING_SERVICE_SID && !value.TWILIO_FROM_NUMBER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_MESSAGING_SERVICE_SID"],
        message:
          'either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER is required when SMS_PROVIDER is "twilio"',
      });
    }
  }

  if (value.RATE_LIMIT_PROVIDER === "upstash") {
    if (!value.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_URL"],
        message: 'is required when RATE_LIMIT_PROVIDER is "upstash"',
      });
    }
    if (!value.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_TOKEN"],
        message: 'is required when RATE_LIMIT_PROVIDER is "upstash"',
      });
    }
  }
});

export type Env = z.infer<typeof baseSchema>;

/** Every variable the application reads, in .env.example order. */
export const ENV_KEYS = Object.keys(baseSchema.shape) as ReadonlyArray<keyof Env>;

export class EnvValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(
      [
        "Invalid environment configuration:",
        ...issues.map((issue) => `  - ${issue}`),
        "",
        "Copy .env.example to .env and fill in the missing values.",
      ].join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

/**
 * Pure parser, exported so tests can exercise it without mutating process.env.
 * Failure names each offending key rather than dumping a raw Zod error (T1.6).
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join(".") || "(root)";
      const detail =
        issue.code === "invalid_type" && issue.received === "undefined"
          ? "is missing"
          : issue.message;
      return `${key} ${detail}`;
    });
    throw new EnvValidationError(issues);
  }

  return result.data;
}

/** Parsed exactly once, at module load. */
export const env: Readonly<Env> = Object.freeze(parseEnv(process.env));

/**
 * Runtime mode. Deliberately NOT part of the schema above: NODE_ENV is set by the
 * runtime, not configured in .env, so adding it would break C16's closed key list.
 * It lives here because this file is the only sanctioned reader of process.env.
 */
export const nodeEnv: string = process.env.NODE_ENV ?? "development";
export const isProduction: boolean = nodeEnv === "production";
