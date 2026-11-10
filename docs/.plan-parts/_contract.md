# BINDING TECHNICAL CONTRACT (v1) — MediBook

Every plan section MUST conform to this contract. It exists so that independently
authored sections agree on names, types, routes, and semantics. If you believe a
contract decision is wrong, DO NOT silently diverge: write your section to the
contract and add a note under "Contract Challenges" at the end of your file.

---

## C1. Product scope
- Single clinic, single tenant, single bookable resource ("the clinic"), many services.
- Explicitly NOT built: multi-clinic, multi-tenant, per-doctor resource scheduling,
  patient login/portal, payments, EHR/medical records, i18n/multi-language.
- Extensibility seams only (documented, not implemented): the slot engine takes a
  "resourceId" parameter hardcoded to the singleton clinic; Appointment carries an
  optional "practitionerId" that is unused in v1.

## C2. Versions (pinned at scaffold time; structure is version-agnostic)
- Next.js 15.x App Router, React 19, TypeScript 5.x "strict": true + "noUncheckedIndexedAccess": true
- Tailwind CSS 3.4.x with tailwind.config.ts (NOT v4 CSS-first) — chosen because the brief
  asks for "design tokens mapped to Tailwind config" and shadcn/ui + plugin ecosystem are
  most predictable on v3.4. v4 migration is listed as a post-v1 option.
- shadcn/ui (CLI-generated, vendored into src/components/ui), lucide-react, tailwindcss-animate
- Prisma 6.x, Zod 3.x, React Hook Form 7.x + @hookform/resolvers
- Auth.js v5 (next-auth@5), @node-rs/argon2
- react-day-picker 9.x, FullCalendar 6.x (@fullcalendar/react + daygrid/timegrid/interaction)
- Recharts 2.x, date-fns 4.x + date-fns-tz 3.x
- Vitest 2.x, @testing-library/react 16.x, Playwright 1.x
- libphonenumber-js (E.164 parse/validate, shared client+server)
- ics generation: hand-rolled RFC 5545 writer in src/lib/ics.ts (no dependency; ~60 lines)

## C3. Database strategy (DEVIATION — must be justified in Section 1)
The brief asks for SQLite in dev and PostgreSQL in prod. With Prisma this is not cleanly
possible for a migration-based workflow: "datasource.provider" cannot be an env() value,
Prisma enums are unsupported on SQLite, and migration SQL is provider-specific.
PINNED RESOLUTION:
- PostgreSQL 16 is the single source of truth for schema + migrations, in dev and prod.
  Dev Postgres comes from "docker compose up -d db" (compose file is part of the repo).
- SQLite remains supported as an OPTIONAL zero-dependency fallback: "pnpm db:sqlite"
  runs scripts/gen-sqlite-schema.ts (rewrites provider + url into prisma/schema.sqlite.prisma)
  then "prisma db push" (no migrations). Documented limitations: no migration history,
  no case-insensitive search, second-resolution timestamps.
- To keep both providers viable the schema uses NO Prisma enums, NO Json columns,
  NO citext, NO Postgres arrays, NO native "@db." type attributes.
- Consequence: all enum-like columns are "String" plus a Zod union + TS const object
  as the single source of truth (src/lib/enums.ts). Postgres gets CHECK constraints via a
  hand-written migration step.

## C4. Canonical enums (String columns, validated by Zod)
- AppointmentStatus: "PENDING_VERIFICATION" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
- Legal transitions (enforced in one place, src/server/appointments/transitions.ts):
  - PENDING_VERIFICATION -> CONFIRMED (OTP verified)
  - PENDING_VERIFICATION -> CANCELLED (hold expiry sweep, or patient abandons)
  - CONFIRMED -> COMPLETED | CANCELLED | NO_SHOW
  - CONFIRMED -> CONFIRMED (reschedule: moves slots inside one transaction)
  - COMPLETED / CANCELLED / NO_SHOW are terminal (no outbound transitions)
- BookingSource: "WEB" | "ADMIN" | "PHONE"
- AdminRole: "OWNER" | "STAFF"  (v1 treats both as full access; role is a seam, and the
  only enforced difference is that STAFF cannot create/delete admin users — which is
  seed-only in v1, so there is no UI for it)
- AuditAction: "APPOINTMENT_STATUS_CHANGED" | "APPOINTMENT_RESCHEDULED" | "APPOINTMENT_CREATED_BY_ADMIN"
  | "SERVICE_CREATED" | "SERVICE_UPDATED" | "SERVICE_DEACTIVATED" | "SETTINGS_UPDATED"
  | "CLOSED_DATE_ADDED" | "CLOSED_DATE_REMOVED" | "ADMIN_LOGIN_SUCCEEDED" | "ADMIN_LOGIN_FAILED"

## C5. Prisma models — canonical names and fields (authoritative)
Use exactly these model and field names everywhere (sections 3,4,5,6,7,9,11,12).
All DateTime values are UTC instants. Money is always integer minor units.

- Service: id(cuid) | slug @unique | name | description | durationMin Int |
  priceMinor Int | isActive Boolean @default(true) | sortOrder Int | colorHex String |
  createdAt | updatedAt | appointments Appointment[]
- Patient: id(cuid) | phoneE164 @unique | fullName | createdAt | updatedAt |
  appointments Appointment[]
  (created/updated only on successful OTP verification — see C9)
- Appointment: id(cuid) | reference @unique | serviceId | patientId String? |
  holdFullName String | holdPhoneE164 String | startsAtUtc DateTime | endsAtUtc DateTime |
  durationMinAtBooking Int | priceMinorAtBooking Int | currencyAtBooking String |
  serviceNameAtBooking String | status String | source String |
  holdExpiresAt DateTime? | verifiedAt DateTime? | confirmedAt DateTime? |
  completedAt DateTime? | cancelledAt DateTime? | cancellationReason String? |
  rescheduledFromUtc DateTime? | adminNote String? | createdAt | updatedAt |
  slots AppointmentSlot[] | otpChallenges OtpChallenge[]
  (the "...AtBooking" snapshot fields exist so later Service edits never rewrite history —
  all revenue KPIs read priceMinorAtBooking, never Service.priceMinor)
- AppointmentSlot: id(cuid) | appointmentId | slotStartUtc DateTime @unique | onDelete: Cascade
  THIS IS THE CONCURRENCY GUARD. One row per atomic slot-interval the appointment occupies
  (ceil(durationMin / slotIntervalMin) rows), all inserted in the same transaction as the
  Appointment. The unique index on slotStartUtc makes overlapping bookings impossible at the
  DB level, which a unique index on Appointment.startsAtUtc alone would NOT achieve.
  Rows are DELETED when a hold expires or an appointment is CANCELLED (freeing the slot);
  they are RETAINED for CONFIRMED / COMPLETED / NO_SHOW.
- OtpChallenge: id(cuid) | appointmentId | phoneE164 | codeHash String | expiresAt DateTime |
  attempts Int @default(0) | maxAttempts Int @default(5) | resendCount Int @default(0) |
  lastSentAt DateTime | consumedAt DateTime? | createdAt
- AdminUser: id(cuid) | email @unique (stored lowercased) | passwordHash | fullName |
  role String | isActive Boolean @default(true) | lastLoginAt DateTime? |
  failedLoginCount Int @default(0) | lockedUntil DateTime? | createdAt | updatedAt
- ClinicSettings: id String @id @default("singleton") | clinicName | timeZone (IANA) |
  currency (ISO-4217) | slotIntervalMin Int @default(15) | bufferMin Int @default(0) |
  minLeadTimeMin Int @default(120) | maxAdvanceDays Int @default(60) |
  holdTtlMin Int @default(10) | phoneE164 | email | addressLine1 | addressLine2 |
  mapUrl | updatedAt
  (exactly one row, id = "singleton"; a CHECK constraint pins id = 'singleton')
- WorkingHour: id(cuid) | weekday Int (0=Sunday..6=Saturday) | openMinute Int | closeMinute Int
  @@unique([weekday, openMinute])
  (minutes-from-midnight in CLINIC-LOCAL wall time; a weekday with zero rows is closed;
  multiple rows per weekday express split shifts, e.g. 09:00-13:00 and 16:00-20:00)
- ClosedDate: id(cuid) | date String @unique ("YYYY-MM-DD" in clinic-local time) | reason String?
  (String not DateTime, deliberately: a calendar date has no instant, and storing it as a
  DateTime invites off-by-one-day bugs across time zones)
- AuditLog: id(cuid) | actorAdminUserId String? | action String | entity String |
  entityId String | metaJson String? | createdAt
  (metaJson is a JSON-serialized string, not a Json column — see C3; never contains PII)

### Required indexes (state these explicitly in Section 4)
- Appointment: @@index([startsAtUtc]) | @@index([status, startsAtUtc]) |
  @@index([serviceId, startsAtUtc]) | @@index([status, holdExpiresAt]) |
  @@index([patientId]) | @@unique([reference])
- AppointmentSlot: @@unique([slotStartUtc]) | @@index([appointmentId])
- OtpChallenge: @@index([appointmentId, createdAt]) | @@index([phoneE164, createdAt])
- Patient: @@unique([phoneE164])
- WorkingHour: @@unique([weekday, openMinute])
- ClosedDate: @@unique([date])
- AuditLog: @@index([createdAt]) | @@index([entity, entityId])

## C6. Time and time zone rules
- Every DateTime in the DB is a UTC instant. No local times are ever persisted.
- Clinic wall-clock inputs (WorkingHour minutes, ClosedDate strings) are clinic-local.
- ClinicSettings.timeZone is the single display/compute zone (seeded "Europe/Berlin").
- Conversion happens ONLY at the boundary, via date-fns-tz: fromZonedTime (local -> UTC)
  and toZonedTime / formatInTimeZone (UTC -> local). Direct "new Date(y,m,d)" is banned
  in server code; an ESLint no-restricted-syntax rule enforces it.
- The slot grid is built in clinic-local wall time, then each candidate start is converted
  to a UTC instant. DST is therefore handled by construction: a spring-forward day simply
  yields fewer valid instants and an autumn fall-back day can yield a repeated wall time,
  which is resolved by preferring the EARLIER UTC INSTANT (the numerically smaller value)
  and de-duplicating on the resulting UTC instant. Section 6 must spell this out.
  WORDING CORRECTION (2026-10-06): this rule previously read "the FIRST (earlier offset)
  instant", which is a trap. On a fall-back day the first occurrence of the wall time has the
  LARGER offset (e.g. 02:00 CEST = +02:00 = 00:00Z), and the second has the smaller
  (02:00 CET = +01:00 = 01:00Z). An implementer reading "earlier offset" literally picks the
  SECOND instant - the wrong one - and that happens to be exactly what date-fns-tz returns by
  default (verified empirically: fromZonedTime("2026-10-25 02:00", "Europe/Berlin") is
  2026-10-25T01:00:00.000Z). So the library default does NOT satisfy this rule: Section 6.3's
  resolveWallTime MUST override it explicitly, and src/lib/dates.ts deliberately does not,
  being a thin boundary wrapper. tests/unit/lib/dates.test.ts pins the library's real
  behaviour so a future upgrade that changes it fails loudly.

## C7. Money and currency
- Integer minor units everywhere; every money field and variable ends in "Minor".
- ClinicSettings.currency is the active ISO-4217 code; Appointment.currencyAtBooking snapshots it.
- Minor-unit exponent comes from Intl.NumberFormat().resolvedOptions().maximumFractionDigits —
  never a hardcoded 100 (handles JOD/KWD 3-digit and JPY 0-digit currencies).
- Formatting lives in exactly one helper: src/lib/money.ts -> formatMoney(minor, currency, locale).
- Revenue sums are computed in minor units as integers and formatted once at the view edge.

## C8. Booking reference
- Format "MB-XXXXXX": 6 chars from Crockford base32 minus vowels and look-alikes
  (alphabet "0123456789ABCDEFGHJKMNPQRSTVWXYZ" minus "IOU" -> use "23456789ABCDEFGHJKMNPQRSTVWXYZ").
- Generated from crypto.randomBytes with rejection sampling; retry up to 5 times on
  unique-constraint collision; case-insensitively normalized (upper) on lookup.
- The reference is a capability token for the success page and .ics download, so it is
  32+ bits of entropy and lookups are rate-limited.

## C9. Booking + OTP lifecycle (authoritative)
1. Patient completes wizard steps 1-5 (service, date, time, details, review+confirm checkbox).
2. "createBooking" action: in ONE Prisma $transaction — re-validate availability, create
   Appointment(status=PENDING_VERIFICATION, holdExpiresAt=now+holdTtlMin, patientId=null)
   plus one AppointmentSlot row per occupied interval. A P2002 unique violation on
   slotStartUtc is mapped to error code SLOT_TAKEN (HTTP 409 semantics).
3. Same action then creates OtpChallenge and calls SmsProvider.sendOtp. SMS send failure
   does NOT roll back the booking; it returns OTP_SEND_FAILED and the UI offers resend.
4. "verifyOtp" action: constant-time compare against codeHash. On success, in ONE transaction:
   upsert Patient by phoneE164 (updating fullName to the latest), set
   status=CONFIRMED, verifiedAt, confirmedAt, patientId, holdExpiresAt=null,
   OtpChallenge.consumedAt. Then fire-and-forget SmsProvider.sendConfirmation.
5. Hold expiry: a PENDING_VERIFICATION appointment past holdExpiresAt is swept to
   status=CANCELLED (cancellationReason="HOLD_EXPIRED") and its AppointmentSlot rows deleted.
   Swept BOTH lazily (at the start of every availability read, inside the same transaction)
   AND by POST /api/cron/expire-holds every 5 minutes. Lazy sweep is what makes correctness
   independent of the cron actually running.
6. Patient is NEVER created for an unverified booking — this is the privacy-minimizing choice
   and it makes "total patients" trivially correct.

## C10. OTP rules (pinned numbers)
- 6 digits, uniform random via crypto.randomInt(0, 1_000_000), zero-padded.
- Stored as HMAC-SHA256(code, OTP_PEPPER) hex; never logged, never returned.
  (HMAC not argon2: the code is 10^6-space but brute force is bounded by maxAttempts=5,
  and OTP verification sits on the p95-latency path.)
- expiresAt = now + 5 min. maxAttempts = 5 (then the challenge is dead; a new one is needed).
- Resend cooldown 60s between sends; max 3 resends per challenge; each resend REPLACES the
  code on the same challenge row, resets attempts to 0, and extends expiresAt.
- A verify attempt against an expired/consumed/dead challenge returns OTP_EXPIRED /
  OTP_MAX_ATTEMPTS without revealing whether the code itself was right.

## C11. Auth (DEVIATION — must be justified in Section 1)
- Auth.js v5 Credentials provider. Auth.js does NOT support the database session strategy
  with Credentials, so the session is a signed+encrypted JWE in an HttpOnly, Secure,
  SameSite=Lax cookie ("__Secure-authjs.session-token" in prod), maxAge 8h, rolling refresh.
  This still satisfies "session-based auth": the browser holds an opaque cookie, not a
  readable token, and there is no localStorage token anywhere.
- Passwords: argon2id via @node-rs/argon2 (memoryCost 19456 KiB, timeCost 2, parallelism 1 —
  OWASP 2024 baseline).
- Split config to keep middleware Edge-safe: "src/auth.config.ts" (providers: [], callbacks
  only, imported by middleware) and "src/auth.ts" (full config incl. Credentials + argon2,
  Node runtime only). Importing argon2 or Prisma into middleware is a build-breaking mistake
  and must be called out.
- middleware.ts matcher protects "/admin/:path*" except "/admin/login"; unauthenticated
  requests redirect to /admin/login?next=<pathname> (open-redirect-safe: only same-origin
  relative paths are honored).
- Every admin Server Action independently re-checks the session via a requireAdmin() guard.
  Middleware is defense-in-depth, never the only check.

## C12. Typed result envelope + error codes
- Every Server Action returns a discriminated union, never throws to the client:
  type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }
  ActionError = { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> }
- ErrorCode union (src/lib/errors.ts), used verbatim in Sections 5, 7, 11:
  "VALIDATION_ERROR" | "RATE_LIMITED" | "SLOT_TAKEN" | "SLOT_UNAVAILABLE" | "HOLD_EXPIRED"
  | "OTP_INVALID" | "OTP_EXPIRED" | "OTP_MAX_ATTEMPTS" | "OTP_RESEND_COOLDOWN"
  | "OTP_SEND_FAILED" | "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_TRANSITION"
  | "CLOSED_DAY" | "OUTSIDE_BOOKING_WINDOW" | "INTERNAL"
- "message" is always a safe, user-displayable string with no PII and no internal detail.
- Actions are wrapped by a single higher-order helper defineAction({ input, handler, auth,
  rateLimit }) in src/server/action.ts which does Zod parse -> rate limit -> auth -> handler
  -> error mapping, so no action body repeats that boilerplate.

## C13. Server Actions vs Route Handlers
- Server Actions are the primary RPC layer (CSRF-protected by Next.js origin checking).
- Route Handlers exist ONLY for these four cases:
  - GET/POST /api/auth/[...nextauth]        (Auth.js)
  - GET  /api/appointments/[reference]/ics  (file download, needs Content-Disposition)
  - POST /api/cron/expire-holds             (Bearer CRON_SECRET, called by Vercel Cron)
  - GET  /api/health                        (uptime probe; no DB-schema detail leaked)
- Section 5 must document actions with a stable identifier of the form
  "action booking.createBooking" alongside the four real HTTP routes.

## C14. Rate limits (pinned)
- Abstraction mirrors SmsProvider: interface RateLimiter { limit(key, rule): Promise<Decision> }
  with MemoryRateLimiter (sliding-window Map, dev/single-instance) and UpstashRateLimiter
  (@upstash/ratelimit, prod/serverless). Selected by env RATE_LIMIT_PROVIDER.
- Keys are HMAC-hashed (never raw phone numbers as cache keys — that is PII at rest).
- Pinned rules:
  - availability.read     60 / 1 min  per IP
  - booking.create         5 / 1 h    per phone  AND 20 / 1 h per IP
  - otp.send               3 / 15 min per phone  AND 10 / 1 h per IP
  - otp.verify            10 / 15 min per appointment
  - reference.lookup      30 / 1 h    per IP
  - admin.login            5 / 15 min per (email+IP), plus AdminUser.lockedUntil = now+15min
                                       after 5 consecutive failures
- Serverless caveat to state explicitly: MemoryRateLimiter is per-instance and therefore
  advisory on Vercel; production MUST use the Upstash provider. The DB-backed
  AdminUser.lockedUntil + OtpChallenge.attempts counters are the authoritative,
  instance-independent limits.

## C15. Routes and rendering strategy (authoritative list)
- /                              SSG at build, revalidate: false. Content from
                                 src/content/site.ts + a build-time Prisma read of active
                                 Services. "No runtime data fetching" is honored: the read
                                 happens at build; "pnpm build" is re-run (or an admin
                                 "Publish site" action triggers revalidatePath('/')) after
                                 service edits. This tension MUST be stated in Section 1.
- /privacy, /terms               SSG, static MDX-free TSX content
- /book                          Static shell + client wizard ("use client" island);
                                 all data via Server Actions. dynamic = 'force-static' shell.
- /book/success/[reference]      Dynamic SSR, no-store, noindex (contains a capability token)
- /admin/login                  Dynamic SSR (reads CSRF/session state)
- /admin                        Dynamic SSR (KPIs), searchParams-driven date range
- /admin/calendar               Dynamic SSR shell + FullCalendar client island
- /admin/appointments           Dynamic SSR, searchParams-driven (page, q, status, service, range)
- /admin/patients               Dynamic SSR, searchParams-driven
- /admin/settings               Dynamic SSR + client forms
- All /admin/* are "export const dynamic = 'force-dynamic'" and noindex.

## C16. Env vars (.env.example must list exactly these)
DATABASE_URL, DIRECT_DATABASE_URL, AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_SITE_URL,
OTP_PEPPER, CRON_SECRET, SMS_PROVIDER(console|twilio), TWILIO_ACCOUNT_SID,
TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_FROM_NUMBER,
RATE_LIMIT_PROVIDER(memory|upstash), UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
CLINIC_TIMEZONE, CLINIC_CURRENCY, CLINIC_DEFAULT_COUNTRY(ISO-3166-1 alpha-2 for the phone
country selector default), SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, LOG_LEVEL
- All env access goes through src/lib/env.ts, which Zod-parses process.env once at startup
  and is the only file allowed to read process.env (ESLint-enforced).

## C17. Folder convention
src/
  app/            (route segments only: page.tsx, layout.tsx, loading.tsx, error.tsx, route.ts)
  features/<feature>/   components/ | actions.ts | schemas.ts | queries.ts | types.ts | hooks/
    features are: landing, booking, otp, admin-auth, dashboard, appointments, patients,
    services, settings
  components/ui/  (shadcn primitives, vendored)
  components/     (shared app-level composites: PageHeader, EmptyState, StatusBadge, ...)
  server/         (db.ts, action.ts, auth guards, slots/, sms/, ratelimit/, audit.ts)
  lib/            (env.ts, money.ts, dates.ts, phone.ts, ics.ts, enums.ts, errors.ts, utils.ts)
  content/        (site.ts: landing copy, FAQ, testimonials, doctors — the single config source)
prisma/           (schema.prisma, migrations/, seed.ts)
tests/            (unit/, component/, e2e/, fixtures/)
- Schemas live in features/<f>/schemas.ts and are imported by BOTH the client form and the
  server action. Zod is the single source of truth; types are inferred, never hand-written.

## C18. Design tokens and accessibility (pinned)
- Token values are EXACTLY the brief's hexes. They are declared as HSL-channel CSS variables
  on :root in globals.css (shadcn convention: "--primary: 174 80% 32%") and mapped in
  tailwind.config.ts via "hsl(var(--primary) / <alpha-value>)".
- CONTRAST RULE (this is a real WCAG constraint, not a nicety): white text on #0D9488 is
  ~3.4:1, which FAILS AA for normal-size text. Therefore:
  - Solid primary buttons with normal-size labels use #0F766E (white text ~4.5:1),
    hover #115E59. The #0D9488 token is reserved for large/bold text (>=18.66px bold),
    icons, borders, focus rings, chart series, and decorative fills (all >=3:1 non-text).
  - Accent coral #F97066 is fill/decoration only. White text on coral (~2.5:1) is BANNED;
    coral-filled CTAs use #0F172A text (~7:1). Coral text on white is BANNED.
  - Muted text #475569 on #F8FAFC is ~7.4:1 (passes). Status colors are paired with an
    icon + text label, never color alone (WCAG 1.4.1 Use of Color).
  - Section 8 must include a contrast table with measured ratios for every pair in use.
- 8px spacing grid (Tailwind default scale, restricted to multiples of 2 = 8px).
- Radius: --radius: 1rem; cards rounded-2xl; inputs/buttons rounded-xl.
- Fonts via next/font/google, self-hosted, display: swap:
  Inter -> --font-sans, Plus Jakarta Sans -> --font-display. No external font requests
  (Lighthouse + privacy).
- Motion: all transitions <=200ms, wrapped in a "@media (prefers-reduced-motion: reduce)"
  block that disables transform/opacity animation. Focus ring is NEVER removed.
- Dark mode: class strategy with a ".dark" block defining the same variables; shipped as a
  nice-to-have behind a toggle, and every token must have a dark value defined even if the
  toggle is not shipped in v1.

## C19. Logging and PII
- One logger (src/lib/logger.ts, pino) with a redaction serializer. NEVER logged:
  phone numbers, full names, OTP codes, passwords, session tokens, booking references,
  raw request bodies. Logged instead: appointmentId, serviceId, a per-request requestId,
  and phoneHash = first 8 hex of HMAC-SHA256(phone, OTP_PEPPER) for correlation.
- Any new log line in a PR touching patient data requires a reviewer check (PR template item).

## C20. Data retention (pinned policy, must appear in Sections 10 and 12)
- Appointments older than 24 months: anonymize in place (holdFullName -> "Redacted",
  holdPhoneE164 -> "+000000000000", patientId retained) so revenue history survives.
- Patients with no appointment in 24 months: hard-deleted.
- OtpChallenge rows: hard-deleted 24h after consumption or expiry.
- AuditLog: retained 24 months.
- Implemented as "scripts/retention.ts" run by a monthly cron; documented in /privacy.

## C21. Document conventions (how to write your section)
- Your file is a FRAGMENT of docs/PLAN.md. It starts with its own "## N. Title" heading
  exactly as the brief names it. Use "###" for subsections, "####" below that. Never use "#".
- Mermaid blocks: fenced with "mermaid". Keep node labels in double quotes if they contain
  spaces, parentheses, or punctuation (unquoted parentheses break the parser). No "end" as a
  bare node id. Prefer "flowchart TD" over the legacy "graph TD". Verify every arrow has a
  valid source and target. Diagrams must be <= ~40 nodes to stay readable.
- Tables are fine and encouraged for specs; keep them under ~8 columns so they render in a
  terminal and on GitHub.
- Refer to other sections as "see Section 6", never by page or line number.
- No application code beyond illustrative snippets: Prisma schema, TS type/Zod signatures,
  pseudocode, and config excerpts are allowed and expected. Do NOT write React components.
- Be concrete: real field names from C5, real error codes from C12, real routes from C15.
- Prefer a tight, high-density spec over prose. No marketing language, no filler.

## C22. Clock seam (required for deterministic tests)
- Direct "new Date()" is banned in src/server/** and src/features/**/actions.ts.
  All current-time reads go through "src/lib/clock.ts": interface Clock { now(): Date }
  with systemClock (prod) and a FixedClock test double.
- The slot engine, hold-expiry sweep, OTP expiry/cooldown, and every KPI date-range
  computation accept a Clock (defaulted via a tiny module-level provider that tests
  override). This is what makes "DST change" and "hold expires mid-wizard" unit-testable
  without sleeping or mocking global Date.
- An ESLint no-restricted-syntax rule enforces the ban; "src/lib/clock.ts" is the only
  exemption.

## C23. Performance and observability budget
- Booking-path p95 < 300ms is measured SERVER-SIDE (action handler duration, excluding
  SMS network I/O which is fire-and-forget / separately timed). Every action logs
  { action, durationMs, outcome } at info level; no PII (see C19).
- Budgets: availability.getSlots < 120ms p95, booking.create < 250ms p95,
  otp.verify < 150ms p95, dashboard KPI aggregate < 400ms p95 (admin, excluded from the
  300ms booking budget and stated as such).
- The availability read is ONE indexed query over AppointmentSlot for the day window plus
  one cached ClinicSettings/WorkingHour read (React cache() per request). No N+1.
- Postgres connection handling on serverless: DATABASE_URL points at a pooled endpoint
  (PgBouncer/Neon pooler) with "?pgbouncer=true&connection_limit=1";
  DIRECT_DATABASE_URL (unpooled) is used only by "prisma migrate".
- Landing page budget: <= 0 third-party scripts, JS <= 90KB gzipped, LCP image
  preloaded via next/image priority, CLS 0 (explicit width/height on every image),
  Lighthouse CI asserts >= 95 in all four categories on every PR.

---

# C24. AMENDMENTS v2 (2026-10-05) — THESE OVERRIDE THE RULES THEY NAME

Produced after a four-lens review of the assembled plan. Where an amendment conflicts with
the rule it names, the amendment wins. Every fragment that states an overridden value must
be corrected.

## A1 (amends C4) — AuditAction symmetry
Add "SERVICE_REACTIVATED" and "ADMIN_LOGGED_OUT". Rationale: an AuditLog reader could not
reconstruct a service's or a session's lifecycle when only the deactivation and the login
were recorded. Every state-changing admin operation now has a logged counter-operation.

## A2 (amends C5) — covering index for dashboard aggregates
Appointment gains "@@index([startsAtUtc, status, serviceId])".
CORRECTION (2026-10-05): this index serves the "appointments by service" aggregate ONLY.
A2 as first written also claimed the "revenue over time" series, which was wrong: that query
filters a single status with equality, where [status, startsAtUtc] seeks and then ranges and is
strictly better than range-then-filter, and this index does not carry priceMinorAtBooking so it
saves no heap fetch there. Sections 9.3 and 9.7 correctly keep [status, startsAtUtc].
Rationale: the "appointments by service" aggregate range-scans on
startsAtUtc, filter on status, and group by serviceId. Leading with startsAtUtc serves the
range, and carrying status and serviceId in the index permits an index-only scan with no
heap lookups. Neither [serviceId, startsAtUtc] (serviceId is a GROUP BY key, not a filter)
nor [status, startsAtUtc] (status is not selective across 3-of-5 values) serves this shape.
Sections 4.5 and 9 must cite this index for those two queries.

## A3 (amends C8) — booking-reference entropy corrected
C8's claim of "32+ bits of entropy" is WRONG. The alphabet is 30 characters and the
reference is 6 characters: 30^6 = 729,000,000 distinct values, which is ~29.4 bits.
The format does NOT change — 6 characters stays, because clinic staff read references
aloud over the phone and a 7th character buys 5 bits at a real usability cost.
The claim must be corrected to "~29.4 bits (30^6, about 7.3 x 10^8 values)" everywhere it
appears, and justified by its actual defences rather than by an inflated number:
the reference.lookup rate limit of 30/hour per IP makes enumeration of even 0.01% of the
space take centuries; the success page is noindex and no-store; and it discloses only
information the person who made the booking already supplied. Any section asserting
"32+ bits" is factually wrong and must be fixed.

## A4 (amends C12) — ACCOUNT_LOCKED is its own error code
Add "ACCOUNT_LOCKED" to the ErrorCode union. FORBIDDEN now means only a permanent
condition (isActive = false, or insufficient role). ACCOUNT_LOCKED means the temporary,
self-clearing lockedUntil window. Rationale: the two demand different UI copy ("contact
the clinic owner" versus "try again in 12 minutes") and different test assertions, and a
caller could previously distinguish them only by parsing message text.

## A5 (amends C13 and C15) — the success page is a classified surface
C13's taxonomy had no category for /book/success/[reference], which is neither a Server
Action nor a Route Handler but DOES resolve a capability token. It is hereby classified as
a "token-resolving page" with these mandatory properties:
- dynamic SSR, "Cache-Control: no-store", "robots: noindex, nofollow"
- the reference.lookup rate limit from C14 is applied IN THE PAGE'S DATA LOADER, keyed by IP
- an unknown or malformed reference renders the same not-found view as an expired one,
  with no timing or wording difference between the two
- the .ics route handler is subject to the same limit and the same uniform not-found
Sections 2, 5, 8 and 10 must reflect this.

## A6 (amends C14) — clinic-wide ceilings and a test bypass
Two additions, both load-bearing.

(a) GLOBAL CEILINGS. Per-phone and per-IP limits do not bound an attacker who rotates
through many distinct numbers, which leaves the financial risk in R-SMS effectively
uncapped. Therefore:
- "otp.send.global": 200 sends per rolling 24h across all phone numbers
- "sms.spend.global": a daily ceiling in minor units, SMS_DAILY_CAP_MINOR
On breach: stop sending, return OTP_SEND_FAILED, emit a CRITICAL log event, and show a
persistent banner in the admin dashboard. Bookings still succeed as PENDING_VERIFICATION
so the clinic can confirm them by hand; the slot is held, not lost.
- "SMS_KILL_SWITCH=true" short-circuits all sending immediately, for use during an attack.

(b) TEST BYPASS. The pinned limits (notably admin.login at 5/15min) would make the required
E2E scenarios E3 and E6 fail on the second CI run of the same day. The limiter therefore
exposes "resetAll()", reachable only through "POST /api/test/reset", which:
- is registered ONLY when NODE_ENV !== "production" AND E2E_TEST_HOOKS === "true"
- resets the in-memory limiter and clears AdminUser.failedLoginCount / lockedUntil
- is called by Playwright's global setup and between the specs that exercise limits
- is asserted ABSENT from a production build by a test in the security suite
Tests must never be made to pass by weakening a production limit.

## A7 (amends C16) — env additions
Add to the closed list: "SMS_DAILY_CAP_MINOR", "SMS_KILL_SWITCH", "E2E_TEST_HOOKS".
These are required by A6 and were previously used by tasks with no env var backing them,
which would have forced an implementer to either hardcode the cap or violate C16.

## A8 (amends C18) — one token vocabulary only
The canonical CSS variable names are EXACTLY those declared in Section 8.3.2 and nowhere
else. The names "--primary-hover", "--primary-hover-dark", "--surface" and "--danger" are
BANNED; use "--primary-button", "--primary-button-hover", "--card" / "--popover" and
"--destructive". The required set that any Phase 2 token task must create in full is:
background, foreground, card, card-foreground, popover, popover-foreground, primary,
primary-foreground, primary-button, primary-button-hover, secondary, secondary-foreground,
accent, accent-foreground, muted, muted-foreground, border, input, ring, destructive,
destructive-foreground, success, warning, info, chart-1, chart-2, chart-3, chart-4,
chart-5, radius — in both the light and the ".dark" block.
Rationale: Phase 8's chart tasks have acceptance criteria requiring hsl(var(--chart-1)) to
resolve, and no Phase 2 task created it. A plan whose Phase 8 cannot pass because Phase 2
built a different vocabulary is broken, not merely inconsistent.

## A9 (amends C17) — server/ layout corrected to match the tasks
- "src/server/appointments/" exists and holds "transitions.ts" (the sole status-transition
  enforcement point, per C4) and "reschedule.ts" (the transactional slot move).
- "src/server/slots/" is TWO modules, not one "engine.ts": "availability.ts" (grid
  construction and the availability queries) and "hold-expiry.ts" (the lazy and cron sweep).
Sections 2, 3, 6 and 12 must all use these names. Any reference to
"src/server/slots/engine.ts" is stale and must be updated.

## A10 (amends C23) — Lighthouse gate must be noise-resistant
Lighthouse CI runs with "numberOfRuns: 3" and asserts the MEDIAN score, not a single run,
in all four categories. A single-run gate fails unrelated PRs on Lighthouse's documented
run-to-run jitter and trains engineers to re-run CI until green, which destroys the gate's
value. Sections 11.7 and 14.4 must state the median method explicitly.

## A11 (new) — SMS carrier registration is a long-lead dependency, scheduled in Phase 1
A2P messaging registration (10DLC in the US and Canada, toll-free verification, or an
alphanumeric sender ID where permitted — alphanumeric IDs are NOT supported in the US or
Canada) takes days to weeks of carrier review that no engineering effort can compress.
It must therefore appear as a long-lead, non-blocking task in PHASE 1 ("initiate Twilio
account and A2P registration, record the expected approval date"), with Phase 12's
provider switch-over declaring a dependency on it. The console SmsProvider covers all
development and testing in the meantime, so nothing else waits on it.

## A12 (amends C9 reporting) — the date-range carve-out must be stakeholder-visible
"Today's appointments" and "Upcoming appointments this week" are clock-anchored by
definition and are deliberately exempt from the shared date-range picker. This is a literal
deviation from the brief's "a date-range filter applied to all KPIs and charts", so it must
appear as a numbered open question in Section 1.4 with the default stated ("ship the
carve-out; the two cards remain clock-anchored and are visually marked as such"), not only
as a note inside Section 9.

## A13 (process) — no stale self-critique
A "Contract Challenges" item that describes a defect a later repair round already fixed must
be DELETED, not left standing. A plan that criticises itself for problems it no longer has
misleads the reader about its own state. Verify each remaining challenge against the current
text before leaving it in place.

## A14 (amends C23) — the landing JS budget was unachievable as written
C23 set "JS <= 90KB gzipped" for the landing page. That figure cannot be met on
this stack and was set without accounting for the React Server Components runtime.
Measured on the real build (Next 15.5, React 19, mobile Lighthouse run):

| Component | Gzipped | Reducible? |
|---|---|---|
| Framework baseline (React + Next App Router runtime) | ~103 KB | No - a bare /_not-found page costs this |
| Landing page app JS (lucide icons, Radix Sheet mobile nav, next-themes toggle) | ~26 KB | Yes, partly |
| Total script transfer | ~129 KB | |

The 90 KB total is therefore impossible: the framework alone exceeds it. The budget
is replaced by a SPLIT budget, which is what an implementer can actually act on:
- Framework baseline: not budgeted (fixed by the stack choice; revisit only by
  changing framework).
- Landing-page APP JS: <= 35 KB gzipped. Currently ~26 KB.
- Total script transfer on the landing page: <= 140 KB. Currently ~129 KB.
Enforced by a `resource-summary:script:size` assertion in lighthouserc.json, so it
is a build gate and not an aspiration.

Still true and still enforced: zero third-party scripts, zero images on the landing
page (verified: 0 image requests, 0 third-party requests), 0 unused JavaScript, and
CLS 0.000.

Available reduction, deliberately not taken in Phase 3: the mobile nav drawer
(Radix Sheet) and the theme toggle (next-themes) are the only client components on
an otherwise fully static page and account for most of the 26 KB. A CSS-only
disclosure nav and dropping the toggle would cut it to near zero. Not done because
the page already scores 98 Performance with 21ms total blocking time, so the work
would buy no measurable user benefit - but if the budget is ever threatened, this
is the first thing to cut.

## A15 (amends C1, C2, C6, C7, C18) — the clinic is in El-Mansoura, Egypt, and the site is Arabic
A stakeholder change of direction, recorded here because several earlier rules assumed a German,
English-language clinic and must not be silently restored.

### Language and direction
- The site is ARABIC ONLY. C1 listed "i18n/multi-language" as explicitly not built, and that
  still holds: there is no locale switcher, no translation framework and no English fallback
  copy. One language, hard-coded, which is the simplest thing that satisfies the brief.
- `<html lang="ar" dir="rtl">`. Because `dir` is set at the root, flexbox and grid flow and
  default text alignment flip automatically; PHYSICAL Tailwind utilities do not, so app code
  uses the logical forms (ms/me, ps/pe, start/end, text-start/text-end, border-s/border-e,
  rounded-s/rounded-e). A directional icon is mirrored with the `rtl:` variant.
- `src/lib/locale.ts` is the single seam: LOCALE, HTML_LANG, HTML_DIR, WEEKDAY_DISPLAY_ORDER
  and WEEKDAY_NAMES_AR. No file may hardcode a locale string; `formatMoney` defaults to LOCALE.

### Typography (amends C18)
- Inter and Plus Jakarta Sans are REMOVED. Neither carries Arabic glyphs, so keeping them would
  have silently fallen back to a system font for every word on the site.
- `--font-sans` is Cairo, `--font-display` is Tajawal, both via next/font/google with the
  "arabic" subset, both still self-hosted at build time (no runtime request to Google).
- Every colour token is unchanged, so the contrast audit in docs/accessibility/ still holds.

### Numerals
- LOCALE pins the Latin numeral system (`ar-EG-u-nu-latn`) on purpose. Plain "ar-EG" renders
  Arabic-Indic digits (٣٠٠٫٠٠ ج.م.), but the slot engine emits clock times as "HH:mm" in Latin
  digits, and two numeral systems on one screen reads badly. Latin digits are also normal in
  Egyptian digital products. Switching the whole site to Arabic-Indic is a one-line change in
  locale.ts — and if that is ever done, the engine's displayLocal strings must be reformatted
  through Intl at the same time, or the inconsistency simply moves.

### Money (amends C7)
- Currency is EGP, stored in piastres (minor units, exponent 2): 300 EGP = 30000. The
  exponent still comes from Intl, never a hardcoded 100, so nothing about C7's rule changes.

### The working week (amends C5's seeded data and Section 6's assumptions)
- FRIDAY (weekday 5) is the closed day, not Sunday. Any code, seed, test or fixture that treats
  Sunday as the weekend is now wrong for this clinic.
- Saturday is a normal working day and the first day of the displayed week.
- Working hours are a SPLIT SHIFT (typically 10:00-14:00 and 17:00-21:00), so the split-shift
  path through the slot engine is now the common case rather than a Saturday-only edge case.

### Time zone (amends C6) — EGYPT OBSERVES DST
- CLINIC_TIMEZONE is Africa/Cairo: GMT+02:00 in winter, GMT+03:00 in summer (Egypt reinstated
  DST in 2023). Verified empirically, not assumed.
- This promotes the DST handling in Section 6 from theoretical to load-bearing. Egypt's
  transitions occur at midnight, so the spring-forward gap (00:00-01:00) currently falls outside
  clinic hours — but `resolveWallTime`'s nonexistent-gap detection and earlier-instant policy are
  what keep that true if the clinic ever opens early, and they must not be removed as dead code.

### Holidays
- ClosedDate rows are Egyptian public holidays. The fixed-date ones (7 Jan, 25 Jan, 25 Apr,
  1 May, 23 Jul, 6 Oct) are reliable. The Islamic holidays (عيد الفطر, عيد الأضحى) are
  LUNAR and their civil dates are announced per year: any seeded value is an estimate and must
  be confirmed against the official Egyptian calendar before launch. The seed marks them as such.

### Open questions this raises for the stakeholder
- OQ-A1: the clinic's real working hours per day, including whether Thursday is a short day.
- OQ-A2: the real service list and prices in EGP.
- OQ-A3: confirmation of the Islamic holiday dates for the launch year.
- OQ-A4: whether prices should display in Arabic-Indic numerals after all.
- OQ-A5: SMS sender registration in Egypt — A11's lead-time warning still applies, and the
  Egyptian regulator (NTRA) has its own sender-ID rules, so this needs starting early.
