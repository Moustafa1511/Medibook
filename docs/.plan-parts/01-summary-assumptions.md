## 1. Summary and Assumptions

### 1.1 What we are building

MediBook replaces phone-only scheduling for one medical clinic with self-service booking, keeping staff in control of the calendar: no multi-clinic ambition, no patient portal, no payments.

Three surfaces: a static SSG landing page listing services and prices; a public reservation wizard (service, date, time, details, review, SMS OTP) turning a visitor into a CONFIRMED appointment; a protected admin area (dashboard, calendar, appointments, patients, settings). One Postgres database, one Next.js deployment, no separate backend.

Done: a patient completes the wizard and gets a double-booking-proof confirmed appointment with an `.ics` file and confirmation SMS; an admin logs in, sees KPIs reconciling against seed data, and drives any appointment through its full status lifecycle without a code change (Section 14 is authoritative).

#### Scope at a glance

| In scope | Explicitly out of scope (C1) | Deferred seam (built, unused) |
|---|---|---|
| Single clinic, one bookable resource, many services | Multi-clinic / multi-tenant | `resourceId` hardcoded to the singleton clinic |
| Guest booking authenticated by phone OTP | Patient login/portal, per-doctor scheduling | `Appointment.practitionerId`, unused |
| Price display, revenue reporting | Payments, insurance billing | `priceMinorAtBooking` snapshot is payment-ready |
| English, one currency, one time zone | i18n, multi-currency | `content/site.ts` isolates copy from logic |
| OWNER/STAFF admin roles, equal access | Per-permission RBAC, admin self-signup | `AdminRole` enum value, no management UI |

### 1.2 Stack decisions and deviations

| Area | Brief recommends | Plan adopts | Deviation? | Justification |
|---|---|---|---|---|
| Framework | Next.js 14+, TS strict | Next.js 15.x, React 19, strict + `noUncheckedIndexedAccess` | Minor (pin) | Current majors at scaffold (C2); flag guards slot-grid math. |
| Styling | Tailwind + shadcn/ui + lucide-react | Tailwind 3.4.x + shadcn/ui + lucide-react + tailwindcss-animate | Yes — D3 | — |
| Database | Prisma, SQLite dev / Postgres prod | Prisma 6.x, Postgres 16 dev+prod, SQLite fallback | Yes — D1 | — |
| Auth | Auth.js, Credentials, bcrypt/argon2, session-based | Auth.js v5 Credentials, argon2, JWT cookie | Yes — D2 | — |
| Validation | Zod, shared client/server | Zod 3.x, same | No | Schemas in `features/<f>/schemas.ts` (C17), shared both sides. |
| Forms | React Hook Form | RHF 7.x + `@hookform/resolvers` | No | Standard Zod bridge. |
| Calendar | react-day-picker / FullCalendar | react-day-picker 9.x / FullCalendar 6.x | No | Version pin. |
| Charts | Recharts | Recharts 2.x | No | Version pin. |
| Dates | date-fns + date-fns-tz | date-fns 4.x + date-fns-tz 3.x | No | Version pin. |
| Testing | Vitest, RTL, Playwright | Vitest 2.x, RTL 16.x, Playwright 1.x | No | Version pin. |
| Tooling | ESLint/Prettier + CI | Same, plus ESLint bans on stray `new Date()` (C22) and `process.env` (C16) | No (additive) | Enforces "no any"-grade discipline beyond convention. |

##### Deviations requiring sign-off

1. **(D1) Postgres in dev, SQLite fallback retained.** Three Prisma blockers (C3): the provider can't be an `env()` value; Prisma enums are unsupported on SQLite; migration SQL is provider-specific, so a SQLite history can't replay on Postgres. Resolution: Postgres 16 is canonical for all migrations (`docker compose up -d db` locally); SQLite is a disconnected `db push` fallback, no migration history.
2. **(D2) JWT sessions, not database sessions.** Credentials is always JWT-encoded in Auth.js v5; database sessions need an Adapter-backed provider, which Credentials isn't. The cookie still satisfies "session-based auth": signed, encrypted, `HttpOnly`, `Secure`, `SameSite=Lax`, never `localStorage`; `requireAdmin()` (C11) re-checks live `AdminUser` state every request, so deactivating an admin takes effect immediately.
3. **(D3) Tailwind 3.4, not v4.** v4 drops `tailwind.config.ts` for CSS-first `@theme`; the brief asks for "tokens mapped to Tailwind config," and shadcn/ui plus `tailwindcss-animate` target v3's JS config most predictably. v4 is a named post-v1 option (C2).
4. **(D4) No Prisma enums, no Json columns.** Consequence of D1 — SQLite supports neither reliably. Cost: no DB-level `CHECK` unless hand-added (C3). Benefit: one enum source of truth — Zod union + `const` object in `src/lib/enums.ts` (C4) — an invalid status is a compile error, not a runtime surprise.
5. **(D5) Additions not in the brief, each load-bearing.**
   - `libphonenumber-js` — E.164 numbering rules are too irregular for a hand-rolled regex (brief §2.4).
   - `@node-rs/argon2` — OWASP-default argon2id; native binding avoids bcrypt's JS cost on cold starts.
   - `docker compose` — satisfies D1's dev Postgres without a native install.
   - Optional Upstash rate limiter — the in-memory limiter is per-instance, non-authoritative on serverless (C14).
   - `pino` — "no PII in logs" needs one logger, one redaction serializer, not scattered `console.log`.
   - Hand-rolled `.ics` writer — single-VEVENT RFC 5545, ~60 lines; not worth a dependency.
6. **(D6) Solid primary buttons use `#0F766E`, not `#0D9488`, for normal-size labels.** White on `#0D9488` measures ~3.4:1, below WCAG AA's 4.5:1 for normal text; white on `#0F766E` measures ~4.5:1. `#0D9488` stays for large/bold text, icons, borders, focus rings, and chart series (non-text 3:1 threshold, C18); table in Section 8.

### 1.3 Assumptions

1. **A1.** One bookable resource (the clinic); no two appointments ever overlap. Slot locking (`AppointmentSlot`, C5) is global, not per-service or per-doctor.
2. **A2.** Landing-page doctors are static bios, not individually bookable. No `DoctorId` exists in the booking path; `practitionerId` (C5) stays unused.
3. **A3.** No payments, no insurance. `priceMinorAtBooking` is a quoted amount only, never a paid/settled flag.
4. **A4.** Patients never log in. Every booking is a guest flow authenticated by the reference (C8) plus the OTP code.
5. **A5.** Only name and E.164 phone are collected; no patient email. `Patient` (C5) has no email field; SMS is the sole contact channel.
6. **A6.** English only, no i18n. `content/site.ts` (C17) is hardcoded English at a single locale.
7. **A7.** One currency (`ClinicSettings.currency`, `CLINIC_CURRENCY`). `money.ts` (C7) formats one locale+currency pair; no per-booking override.
8. **A8.** One IANA time zone (`ClinicSettings.timeZone`, `CLINIC_TIMEZONE`). Every patient-facing time renders clinic-local regardless of visitor locale.
9. **A9.** Patients cannot self-cancel/reschedule in v1; changes require phoning the clinic. Only an admin reaches `CONFIRMED -> CONFIRMED` (C4); no public "manage my booking" route exists.
10. **A10.** Admins can change any appointment's status at any time. Table actions are gated only by `requireAdmin()` (C11).
11. **A11.** No waitlist. A full day shows zero slots; no "notify when freed" path exists.
12. **A12.** No recurring appointments. `Appointment` has no series field; the wizard never offers "repeat weekly."
13. **A13.** No automated reminder SMS in v1. `SmsProvider` (C9) fires only at OTP send and confirmation.
14. **A14.** SMS cost is the clinic's; a Twilio account exists or will, with carrier registration (A2P 10DLC in the US/Canada, toll-free verification, or an alphanumeric sender ID where permitted) initiated in Phase 1, not deferred to launch. `TWILIO_*` (C16) is a provisioning prerequisite; `SMS_PROVIDER=console` is the pre-launch default and covers all development and testing, so nothing else waits on it — carrier review itself takes days to weeks that no engineering effort compresses.
15. **A15.** Testimonials/bios are clinic-authored copy, not user-generated. No submission form or moderation exists; `content/site.ts` is hand-edited.
16. **A16.** Under ~200 appointments/week. The single-row-per-slot unique constraint (C5) is sufficient; no queue or distributed lock is designed.
17. **A17.** Admins are seeded (`seed.ts`, `SEED_ADMIN_*`), not self-registered. No "create admin" UI exists; `AdminRole=STAFF` (C4) is schema-only.
18. **A18.** Last two versions of evergreen browsers; no legacy polyfills. Modern CSS and native `<input type="tel">` are used directly within the JS budget (C23).
19. **A19.** "No runtime fetching" is honored by rebuild/revalidate, not per-request query. A Service edit needs a rebuild or `revalidatePath('/')` (C15) to appear on `/`.
20. **A20.** One physical location. `ClinicSettings` (C5) and the landing page model exactly one address.
21. **A21.** Slot starts align to `slotIntervalMin` regardless of service duration. A 20-minute service on a 15-minute grid occupies `ceil(20/15)=2` rows (C5).
22. **A22.** Patient-count KPIs count unique verified `Patient` rows (C9 step 6). An unverified hold creates no `Patient` row, invisible to those KPIs by construction.

### 1.4 Open questions for the stakeholder

1. **OQ1.** Exact clinic time zone? *Default:* `Europe/Berlin` (C6).
2. **OQ2.** Exact currency (ISO-4217)? *Default:* `EUR`.
3. **OQ3.** Real weekly hours, including split shifts? *Default:* Mon–Fri 09:00–18:00, Sat 09:00–13:00, Sun closed (`WorkingHour`, C5).
4. **OQ4.** Holiday/closed-date list, next 12 months? *Default:* empty `ClosedDate`; admin adds via Settings.
5. **OQ5.** Real service catalogue (names, durations, prices)? *Default:* five placeholder services, illustrative EUR prices, editable before go-live.
6. **OQ6.** Does NO_SHOW count toward revenue? *Default:* no — only `COMPLETED` (actual) and `CONFIRMED` upcoming (expected) count (Section 9).
7. **OQ7.** Should patients self-cancel/reschedule in a later release? *Default:* no in v1 (A9); top post-v1 candidate.
8. **OQ8.** Is a 24h reminder SMS wanted in v1? *Default:* no (A13); adding it later touches one call site plus a cron entry.
9. **OQ9.** Who owns the Twilio account and sender identity? *Default:* `SMS_PROVIDER=console` until credentials exist.
10. **OQ10.** Does the 24-month retention window (C20) match local law? *Default:* provisional, pending legal confirmation; one constant in `retention.ts` controls it.
11. **OQ11.** Who is the data controller named in `/privacy`? *Default:* placeholder `[Clinic Legal Name]`; not an engineering blocker.
12. **OQ12.** Does dark mode ship as a toggle in v1? *Default:* defined-but-unexposed — tokens exist (C18), no toggle UI.
13. **OQ13.** What is the production domain? *Default:* a placeholder `*.vercel.app` domain until supplied.
14. **OQ14.** "Today's appointments" and "Upcoming appointments this week" are clock-anchored and deliberately exempt from the shared date-range picker (Section 9.1) — a literal deviation from the brief's "a date-range filter applied to all KPIs and charts." Ship the carve-out, or force both cards onto the picker? *Default:* ship the carve-out; the two cards stay clock-anchored and are visually marked as such (an "always current" badge, not a picker-bound control), so the deviation reads as deliberate rather than missed.
15. **OQ15.** Which country is the clinic's primary SMS jurisdiction (US/Canada require A2P 10DLC or toll-free verification; an alphanumeric sender ID may be usable elsewhere), and is its owner the same party named in OQ9? *Default:* unknown pending stakeholder confirmation; `SMS_PROVIDER=console` covers all development and testing in the meantime, so nothing else waits on it — but Phase 1 should initiate carrier registration the moment the country is known, since the review itself takes days to weeks that no engineering effort compresses.

### 1.5 Success criteria

- All 14 plan sections exist in `docs/PLAN.md`, conforming to C1–C23; Section 14 is the single completeness gate.
- The full wizard (service → date → time → details → review → OTP → success) completes end to end against the Section 4 schema (Section 11, "full booking flow").
- Two simultaneous bookings for one slot cannot both reach `CONFIRMED`; one gets `SLOT_TAKEN` (Section 11, "double-booking race"; C12).
- Every Section 9 KPI is reproducible from `prisma/seed.ts` data (Section 11, "KPI accuracy").
- Lighthouse CI reports ≥95 in all four categories for `/`, zero third-party scripts, ≤90KB gzipped JS (C23).
- Section 8's contrast table shows every text/background pair at ≥4.5:1 (normal) or ≥3:1 (large/non-text), per C18.
- Server-side p95 is under 300ms for `booking.create`, 120ms for `availability.getSlots`, 150ms for `otp.verify` (C23).
- Every `ErrorCode` in C12 has a triggering test in Section 11; no Server Action throws uncaught.

#### Contract Challenges

- **C3 (SQLite fallback):** no CI step keeps `schema.sqlite.prisma` in sync with the canonical schema, so it can silently rot. Recommend a CI job that regenerates and diffs it, or downgrading it to an explicitly unverified escape hatch.
- **C17 (`otp` as a sibling of `booking`):** C9 runs OTP creation/verification inside booking's own transactions, so an independent `otp` feature with its own `actions.ts` invites duplicated transaction logic. Recommend `features/otp` export pure helpers called from inside `features/booking/actions.ts`, not top-level Server Actions of its own.
