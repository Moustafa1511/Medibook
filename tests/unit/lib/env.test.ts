import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ENV_KEYS, EnvValidationError, parseEnv } from "@/lib/env";

/** C16 as amended by A7 — the closed list. Hardcoded so drift fails loudly. */
const EXPECTED_KEYS = [
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "NEXT_PUBLIC_SITE_URL",
  "OTP_PEPPER",
  "CRON_SECRET",
  "SMS_PROVIDER",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_FROM_NUMBER",
  "SMS_DAILY_CAP_MINOR",
  "SMS_KILL_SWITCH",
  "RATE_LIMIT_PROVIDER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CLINIC_TIMEZONE",
  "CLINIC_CURRENCY",
  "CLINIC_DEFAULT_COUNTRY",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
  "LOG_LEVEL",
  "E2E_TEST_HOOKS",
] as const;

function envExampleKeys(): string[] {
  const file = readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");
  return file
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [key] = line.split("=");
      return key ?? "";
    })
    .filter((key) => key.length > 0);
}

const VALID: Record<string, string> = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=public",
  DIRECT_DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=public",
  AUTH_SECRET: "a".repeat(32),
  AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  OTP_PEPPER: "b".repeat(32),
  CRON_SECRET: "c".repeat(16),
  SMS_PROVIDER: "console",
  SMS_DAILY_CAP_MINOR: "50000",
  SMS_KILL_SWITCH: "false",
  RATE_LIMIT_PROVIDER: "memory",
  CLINIC_TIMEZONE: "Europe/Berlin",
  CLINIC_CURRENCY: "EUR",
  CLINIC_DEFAULT_COUNTRY: "DE",
  SEED_ADMIN_EMAIL: "admin@medibook.local",
  SEED_ADMIN_PASSWORD: "password123",
  LOG_LEVEL: "debug",
  E2E_TEST_HOOKS: "false",
};

describe(".env.example", () => {
  it("lists exactly the 24 contract variables, in schema order", () => {
    expect(envExampleKeys()).toEqual([...EXPECTED_KEYS]);
  });

  it("ships no values", () => {
    const file = readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");
    const withValues = file.split("\n").filter((line) => /^[A-Z0-9_]+=.+/.test(line.trim()));
    expect(withValues).toEqual([]);
  });

  it("matches the schema's own key list", () => {
    expect([...ENV_KEYS]).toEqual([...EXPECTED_KEYS]);
  });
});

describe("parseEnv", () => {
  it("accepts a valid console/memory configuration", () => {
    const parsed = parseEnv(VALID);
    expect(parsed.SMS_PROVIDER).toBe("console");
    expect(parsed.RATE_LIMIT_PROVIDER).toBe("memory");
  });

  it("coerces SMS_DAILY_CAP_MINOR to a number and the flags to booleans", () => {
    const parsed = parseEnv({ ...VALID, SMS_KILL_SWITCH: "true" });
    expect(parsed.SMS_DAILY_CAP_MINOR).toBe(50_000);
    expect(parsed.SMS_KILL_SWITCH).toBe(true);
    expect(parsed.E2E_TEST_HOOKS).toBe(false);
  });

  it("names the missing key instead of dumping a Zod error", () => {
    const { DATABASE_URL: _omitted, ...withoutDatabaseUrl } = VALID;
    let caught: unknown;
    try {
      parseEnv(withoutDatabaseUrl);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    expect((caught as Error).message).toContain("DATABASE_URL is missing");
    expect((caught as Error).message).toContain(".env.example");
  });

  it.each([
    ["SMS_PROVIDER", "console"],
    ["SMS_PROVIDER", "twilio"],
  ])("accepts %s=%s", (key, value) => {
    const source = { ...VALID, [key]: value };
    if (value === "twilio") {
      source.TWILIO_ACCOUNT_SID = "AC123";
      source.TWILIO_AUTH_TOKEN = "token";
      source.TWILIO_FROM_NUMBER = "+15555550100";
    }
    expect(() => parseEnv(source)).not.toThrow();
  });

  it("rejects an SMS_PROVIDER outside the union", () => {
    expect(() => parseEnv({ ...VALID, SMS_PROVIDER: "carrier-pigeon" })).toThrow(
      EnvValidationError,
    );
  });

  it.each([
    ["memory", {}],
    ["upstash", { UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }],
  ])("accepts RATE_LIMIT_PROVIDER=%s", (value, extra) => {
    expect(() => parseEnv({ ...VALID, RATE_LIMIT_PROVIDER: value, ...extra })).not.toThrow();
  });

  it("rejects a RATE_LIMIT_PROVIDER outside the union", () => {
    expect(() => parseEnv({ ...VALID, RATE_LIMIT_PROVIDER: "redis" })).toThrow(EnvValidationError);
  });

  it("requires Twilio credentials only once Twilio is selected", () => {
    expect(() => parseEnv({ ...VALID, SMS_PROVIDER: "twilio" })).toThrow(
      /TWILIO_ACCOUNT_SID is required when SMS_PROVIDER is "twilio"/,
    );
  });

  it("requires Upstash credentials only once Upstash is selected", () => {
    expect(() => parseEnv({ ...VALID, RATE_LIMIT_PROVIDER: "upstash" })).toThrow(
      /UPSTASH_REDIS_REST_URL is required when RATE_LIMIT_PROVIDER is "upstash"/,
    );
  });

  it("rejects an invalid IANA time zone", () => {
    expect(() => parseEnv({ ...VALID, CLINIC_TIMEZONE: "Mars/Olympus_Mons" })).toThrow(
      /CLINIC_TIMEZONE/,
    );
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => parseEnv({ ...VALID, AUTH_SECRET: "tooshort" })).toThrow(
      /AUTH_SECRET must be at least 32 characters/,
    );
  });
});
