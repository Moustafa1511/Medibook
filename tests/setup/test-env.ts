/**
 * Deterministic environment for every test run. Runs before any test file is
 * imported, so `src/lib/env.ts` parses successfully on import.
 *
 * Deliberately does NOT read the developer's .env: tests must behave the same
 * on a laptop and in CI.
 */
const TEST_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://medibook:medibook@localhost:5432/medibook_test?schema=public",
  DIRECT_DATABASE_URL: "postgresql://medibook:medibook@localhost:5432/medibook_test?schema=public",
  AUTH_SECRET: "test-auth-secret-at-least-32-chars-long",
  AUTH_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  OTP_PEPPER: "test-otp-pepper-at-least-32-chars-long!",
  CRON_SECRET: "test-cron-secret-16",
  SMS_PROVIDER: "console",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  TWILIO_MESSAGING_SERVICE_SID: "",
  TWILIO_FROM_NUMBER: "",
  SMS_DAILY_CAP_MINOR: "50000",
  SMS_KILL_SWITCH: "false",
  RATE_LIMIT_PROVIDER: "memory",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  CLINIC_TIMEZONE: "Africa/Cairo",
  CLINIC_CURRENCY: "EGP",
  CLINIC_DEFAULT_COUNTRY: "EG",
  SEED_ADMIN_EMAIL: "admin@medibook.test",
  SEED_ADMIN_PASSWORD: "test-password",
  LOG_LEVEL: "silent",
  E2E_TEST_HOOKS: "false",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
