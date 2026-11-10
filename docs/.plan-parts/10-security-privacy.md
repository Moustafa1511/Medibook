## 10. Security and Privacy Checklist

Controls are organized by trust boundary, matching Section 2's layering (`middleware.ts` → Server Actions → `server/` → `lib/`). Every **Status** is `Planned` — nothing here is built yet; "How verified" names the test, lint rule, header check, or manual step that will prove it. Paths are canonical per Section 3; `(new)` flags this section's own proposed addition.

### 10.1 Input validation and injection

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| VAL-1 | Every Server Action's input is Zod-parsed inside `defineAction` before the handler runs; a client bypass cannot skip server re-parsing (C12) | `src/server/action.ts` | `schemas.test.ts`; manual replay of a tampered action POST confirms `VALIDATION_ERROR` | Planned |
| VAL-2 | One schema object per feature, imported by both the form and `actions.ts` — client validation is UX only, never authoritative (2.2) | `src/features/booking/schemas.ts` and siblings | PR review: action's schema import resolves to the same export as the form's | Planned |
| VAL-3 | Prisma is the only DB access path; `$queryRawUnsafe`/`$executeRawUnsafe` banned repo-wide; `$queryRaw` allowed only at the one site in VAL-4 | `eslint.config.mjs`, new `no-restricted-properties` rule `(new)` | ESLint CI step fails on any disallowed call | Planned |
| VAL-4 | The one raw-SQL site: the KPI aggregate (9.10). SQL text is a static constant; all date/range values bind via `Prisma.sql`'s own tagged-template `${}` interpolation, which Prisma parameterizes automatically — never string-concatenated | `src/features/dashboard/queries.ts` | Lint rule bans `$queryRawUnsafe`/`$executeRawUnsafe` calls and raw string concatenation into SQL text, while explicitly allowing `${}` interpolation inside a `Prisma.sql`/tagged-template call; code review | Planned |
| VAL-5 | Phone normalization: E.164 parse/validate shared client+server via libphonenumber-js, never a bare regex | `src/lib/phone.ts`, used by `booking/schemas.ts` | `phone.test.ts` — invalid, missing-country-code, cross-country cases | Planned |
| VAL-6 | Name normalization: 2–80 chars, Unicode letters (`\p{L}`)/spaces/hyphens/apostrophes (assumption: Unicode, not ASCII-only, so non-English names aren't rejected). Injection-shaped strings are stored as inert text, never executed — Prisma parameterizes every write | `booking/schemas.ts` (`fullNameSchema`) | Table-driven `schemas.test.ts`: accented names, SQL-metacharacter strings | Planned |
| VAL-7 | Pagination/range bounds on every list query (`page`≥1, `pageSize` 1–100) and max-length caps on free-text fields (`adminNote`, settings strings), enforced server-side regardless of UI | `appointments/patients/dashboard/schemas.ts`, shared `Paginated<T>` in `server/action.ts` | Unit tests assert out-of-range values are rejected, never passed to Prisma's `skip`/`take` | Planned |

### 10.2 Authentication and session

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| AUTHN-1 | argon2id, `memoryCost 19456 KiB, timeCost 2, parallelism 1` (OWASP 2024 baseline, C11) | `src/auth.ts` via `@node-rs/argon2` | Unit test asserts the exact options object passed to `hash()`/`verify()` | Planned |
| AUTHN-2 | Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Secure-authjs.session-token` in prod, 8h `maxAge`, rolling refresh (C11) | `src/auth.ts` | `admin-login.spec.ts` inspects `Set-Cookie` attributes; manual devtools check on staging | Planned |
| AUTHN-3 | Session rotation on login: a fresh JWE mints at every sign-in (no fixation vector); `failedLoginCount` resets to 0 on success | `src/auth.ts` | E2E logs in twice in two contexts, asserts distinct cookie values | Planned |
| AUTHN-4 | Logout invalidation, caveat stated honestly: `signOut()` clears the cookie client-side, but the JWE stays cryptographically valid until its 8h `maxAge` — Credentials sessions aren't DB-backed (C11), so there is **no server-side revocation** in v1 | `src/auth.ts` (no revocation store) | Manual: capture cookie pre-logout, sign out, replay it against an admin route; document the result (feeds 10.11) | Planned |
| AUTHN-5 | Lockout: `lockedUntil = now+15min` after 5 consecutive failures, checked **before** the password compare and returning the dedicated `ACCOUNT_LOCKED` code — distinct from `FORBIDDEN`, which now means only a permanent condition (`isActive=false` or insufficient role) (C14; C12 amendment A4) | `src/auth.ts` | Unit test: 6th attempt returns `ACCOUNT_LOCKED`, not a generic failure, even when the password is correct | Planned |
| AUTHN-6 | Login-time outcomes stay enumeration-safe under the amended codes (A4). "Unknown email," "wrong password," and "deactivated" (`isActive=false`) all return the identical generic `CredentialsSignin` failure — a deactivated account is rejected by the same `authorize()` check as a wrong password, never by `FORBIDDEN` (`FORBIDDEN` is reachable only post-login, from `requireAdmin()` on an already-authenticated session, AUTHZ-3 — i.e. only after correct credentials). "Locked" now returns the distinct `ACCOUNT_LOCKED`, but this stays uniform across unknown and known emails too: reaching it requires 5 consecutive prior failures already recorded against that exact identifier, and RATE-6's soft (email+IP) limiter saturates at that same threshold and window, so a 6th probe inside 15 minutes gets the identical `RATE_LIMITED` response whether or not the email is real — the locked/not-locked split is never observable within one probing window | `features/admin-auth/actions.ts` single `CredentialsSignin` path for the generic case; the `ACCOUNT_LOCKED` branch is checked separately (C14, C12 A4) | Unit test asserts byte-identical `ActionError.message` for unknown-email/wrong-password/deactivated; a second test confirms a 6th same-window attempt returns `RATE_LIMITED` (never `ACCOUNT_LOCKED`) for both a real locked account and a nonexistent one | Planned |
| AUTHN-7 | No password reset in v1 (no email channel, C1). Consequence: recovery is manual — an operator re-runs the seed admin upsert with a new `SEED_ADMIN_PASSWORD`, or updates `AdminUser` directly | README.md "Admin recovery" `(new)` | Manual drill: reset a locked seed admin on a non-prod branch database | Planned |

### 10.3 Authorization

Every admin boundary is checked twice: `middleware.ts` (Edge, shallow JWE check) and `requireAdmin()` inside the action (Node, re-reads live `AdminUser` state) — middleware is defense-in-depth only (C11). The booking `reference` gets separate treatment: it **is** the authorization for `/book/success/[reference]` and the `.ics` download, with no login (C8); both are classified a **token-resolving page** (C13/C15 amendment A5 — full control set at AUTHZ-7). Entropy: 6 chars over a 30-symbol alphabet is `30^6 = 729,000,000` (~7.3×10^8 values, **~29.4 bits** — C8 amendment A3). The real control is layering, not keyspace: `reference.lookup` capped 30/1h/IP (C14), enforced inside the page's own data loader rather than in client code, makes exhaustive guessing infeasible — even enumerating 0.01% of the keyspace from a single IP at that cap is a centuries-long undertaking; `noindex, nofollow` plus `no-store` (C15, A5) keeps a leaked reference out of search/caches; an unknown, malformed, or expired reference all render the identical not-found view with no timing or wording difference, so a response can never be used to binary-search the keyspace; and the page exposes only one appointment's logistics — information the booker already supplied, never an email, address, or medical record — so a guess discloses one booking, never a patient record.

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| AUTHZ-1 | Middleware matcher protects `/admin/:path*` except `/admin/login`; unauth redirects to login (C11, C15) | `src/middleware.ts` | `admin-login.spec.ts`: every `/admin/*` page redirects logged-out; login itself doesn't | Planned |
| AUTHZ-2 | `requireAdmin()` independently re-checked in every admin action, not inferred from middleware | `src/server/auth-guards.ts`, called from `appointments/services/settings/actions.ts` | Unit test invokes a handler directly (no routing) with no/expired/deactivated/locked sessions, asserts `UNAUTHORIZED`/`FORBIDDEN`/`ACCOUNT_LOCKED` (C12 amendment A4) | Planned |
| AUTHZ-3 | `requireAdmin()` reads live `isActive`/`lockedUntil`, not just token validity — deactivation takes effect mid-session. `isActive=false` returns `FORBIDDEN` (permanent); a live `lockedUntil` window returns the distinct, temporary `ACCOUNT_LOCKED` (C12 amendment A4) | `src/server/auth-guards.ts` | Integration test: deactivate an admin mid-session, next call returns `FORBIDDEN`; a parallel test sets `lockedUntil` on an active session's `AdminUser` and asserts the next call returns `ACCOUNT_LOCKED` | Planned |
| AUTHZ-4 | Open-redirect-safe `next`: accepted only if it matches `^/admin(?:/.*)?$`, else falls back to `/admin` | `src/middleware.ts`; `admin-auth/actions.ts` | Unit test feeds `https://evil.com`, `//evil.com`, `../../etc`; asserts fallback every time | Planned |
| AUTHZ-5 | Booking reference as capability token — entropy/rate-limit/noindex analysis above (C8 amendment A3); full page-level control set at AUTHZ-7 | `src/lib/reference.ts` (C8); `ratelimit/rules.ts`; `book/success/[reference]/page.tsx`; `api/appointments/[reference]/ics/route.ts` | `reference.test.ts` `(new)` asserts the 30-symbol alphabet's exclusion/distribution; E2E: 31st lookup/hour returns `RATE_LIMITED` | Planned |
| AUTHZ-6 | No PII in any URL beyond the reference — no route embeds `phoneE164`, email, or an `Appointment.id` | Convention across `src/app/**` | CI grep `(new)`: no `params.*id` renders patient data into a URL | Planned |
| AUTHZ-7 | `/book/success/[reference]` and the `.ics` route are a classified **token-resolving page** (C13/C15 amendment A5): dynamic SSR, `Cache-Control: no-store`, `robots: noindex, nofollow`; the `reference.lookup` limit (RATE-5) runs inside the page's own Server Component data loader and inside the route handler, keyed by IP, never in client code; an unknown, malformed, or expired reference renders the identical not-found view, with no timing or wording difference between the three `(new)` | `book/success/[reference]/page.tsx`; `api/appointments/[reference]/ics/route.ts` | E2E: unknown/malformed/expired references produce byte-identical not-found HTML; a response-time assertion confirms no measurable gap between the three; header check confirms `no-store` and `noindex, nofollow` on both routes | Planned |

### 10.4 CSRF and request integrity

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| CSRF-1 | Server Actions: Next's built-in same-origin Origin/Host check runs before the action body executes (2.4) — framework-level, not app code | `next.config.mjs` (`allowedOrigins` restricted to prod domain) | Manual cross-origin fetch from a foreign-origin context confirms rejection | Planned |
| CSRF-2 | Auth.js's own double-submit CSRF cookie protects the Credentials sign-in POST — a Route Handler, not covered by CSRF-1 | `src/auth.ts` / `api/auth/[...nextauth]/route.ts` | `admin-login.spec.ts` posts with the csrf cookie stripped/mismatched, asserts rejection | Planned |
| CSRF-3 | `SameSite=Lax` blocks the cookie on cross-site POST/fetch while allowing it on a clicked link; no GET handler has a side effect, so Lax's one gap doesn't apply | `src/auth.ts` cookie config | Code review: no `route.ts` GET or RSC page calls `db.*.create/update/delete` | Planned |
| CSRF-4 | Cron route is Bearer-authenticated, not CSRF-protected — its caller (Vercel Cron) has no cookie jar or matching Origin; CSRF assumes a browser attacker and would block the legitimate caller | `api/cron/expire-holds/route.ts`, `CRON_SECRET` (C13) | Integration test: missing/wrong `Authorization` header → `401`, zero DB writes | Planned |

### 10.5 Rate limiting and abuse

The pinned C14 rules, restated with where each is enforced, plus SMS-pumping-specific controls — including the clinic-wide ceilings at RATE-9, since per-phone and per-IP limits alone cannot bound an attacker who simply rotates through many distinct numbers:

| ID | Rule / limit | Where implemented | How verified | Status |
|---|---|---|---|---|
| RATE-1 | `availability.read`: 60/1min/IP | `ratelimit/rules.ts`; `availability.getAvailableDays/Slots` | `ratelimit.test.ts`: 61st call/min is `RATE_LIMITED` | Planned |
| RATE-2 | `booking.create`: 5/1h/phone AND 20/1h/IP | `rules.ts`; `booking/actions.ts` `createBooking` | `ratelimit.test.ts`: both keys trip independently | Planned |
| RATE-3 | `otp.send`: 3/15min/phone AND 10/1h/IP | `rules.ts`; `otp/actions.ts` `resendOtp` + internal send in `createBooking` | `ratelimit.test.ts`; E2E distinguishes `OTP_RESEND_COOLDOWN` (60s timer, C10) from `RATE_LIMITED` (this cap) | Planned |
| RATE-4 | `otp.verify`: 10/15min/appointment | `rules.ts`; `otp/actions.ts` `verifyOtp` | `ratelimit.test.ts`; distinct from `OtpChallenge.maxAttempts=5`, which caps one challenge row | Planned |
| RATE-5 | `reference.lookup`: 30/1h/IP | `rules.ts`; enforced inside `book/success/[reference]/page.tsx`'s data loader (not a client fetch) + `api/appointments/[reference]/ics/route.ts` (C13/C15 amendment A5) | `ratelimit.test.ts` + E2E | Planned |
| RATE-6 | `admin.login`: 5/15min/(email+IP) soft + `lockedUntil` hard (authoritative across instances) | `rules.ts` (soft) + `AdminUser.lockedUntil` (hard, C14) | Integration test: DB lockout alone catches a 6th failure under two independent limiter instances | Planned |
| RATE-7 | Challenges per appointment bounded structurally: `resendCount` maxes at 3 (C10), so one `OtpChallenge` sends ≤4 SMS; a new challenge needs a fresh `booking.create` (RATE-2). Assumption: a 4th resend maps to `OTP_MAX_ATTEMPTS` — C12 has no dedicated "resend exceeded" code (Contract Challenges) | `otp/actions.ts` `resendCount` check | `otp.test.ts` asserts the 4th resend is rejected, no 4th SMS sent | Planned |
| RATE-8 | Country allowlist on the phone selector: both UI and server-side validation reject numbers outside a configured list — the single largest lever against SIM-farm pumping. Assumption: static list seeded from `CLINIC_DEFAULT_COUNTRY` (C16), not a new env var | `src/lib/phone.ts` `ALLOWED_COUNTRIES` `(new)` | `phone.test.ts`: disallowed-country numbers rejected regardless of E.164 validity | Planned |
| RATE-9 | Clinic-wide SMS ceilings (C14 amendment A6a), because RATE-2/RATE-3's per-phone and per-IP caps bound one number or one IP each, not a fleet of rotated numbers: `otp.send.global` caps sends at 200 per rolling 24h across all phone numbers; `sms.spend.global` caps spend at `SMS_DAILY_CAP_MINOR` minor units per UTC day — both checked before every `SmsProvider` call. On breach: sending stops, the call returns `OTP_SEND_FAILED` (the appointment still succeeds as `PENDING_VERIFICATION` so the clinic can confirm it by hand — the slot is held, not lost, C9.3), a `CRITICAL` log event fires, and a persistent banner shows in the admin dashboard. `SMS_KILL_SWITCH=true` short-circuits all sending immediately, for use mid-attack | `server/sms/index.ts` wrapper `(new)` | `sms/provider.test.ts` `(new)`: the 201st global send in 24h, and the first send that would exceed `SMS_DAILY_CAP_MINOR`, both fail without reaching Twilio; manual kill-switch drill in staging | Planned |
| RATE-10 | Monitoring for a spike in unverified bookings: the `PENDING_VERIFICATION`:`CONFIRMED` ratio over a rolling hour is the earliest pumping signal; `GET /api/health` returns a coarse boolean flag (no raw counts) once it crosses a threshold vs. the seeded baseline (~6.7%, 4.6) | `api/health/route.ts` (extended) | Manual: synthetic load creates 50 unverified holds, confirms the flag flips | Planned |
| RATE-11 | Test-only limiter bypass (C14 amendment A6b): `POST /api/test/reset` calls the limiter's `resetAll()` and clears `AdminUser.failedLoginCount`/`lockedUntil`; registered only when `NODE_ENV !== "production"` AND `E2E_TEST_HOOKS === "true"`; used by Playwright's global setup and between specs so E3/E6 don't fail on a same-day second CI run. A production limit is never weakened to make a test pass | `src/app/api/test/reset/route.ts` `(new)`, gated via `src/lib/env.ts`'s `E2E_TEST_HOOKS` | Security-suite test `(new)` asserts the route is absent (no handler/404) from a production build (`NODE_ENV=production`, `E2E_TEST_HOOKS` unset) | Planned |

### 10.6 Secrets and configuration

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| CFG-1 | Secrets live only in `.env`, never committed or hardcoded | `.env` (not in repo) | CI secret-scan step `(new)`; `git log --all -- .env` shows no history | Planned |
| CFG-2 | `.env.example` lists exactly C16's var names, no values | `.env.example` | CI step `(new)` diffs names parsed from the file against the literal C16 list | Planned |
| CFG-3 | `src/lib/env.ts` is the sole `process.env` reader, Zod-validated once at startup | `src/lib/env.ts`; ESLint ban elsewhere (C16) | ESLint CI step fails on any other `process.env` access | Planned |
| CFG-4 | Secrets reach production as Vercel Project Environment Variables, scoped per environment, never via a committed file (2.6) | Vercel dashboard / `vercel env add` | Manual deploy checklist: every C16 var present in Production | Planned |
| CFG-5 | `AUTH_SECRET` rotation is clean — every JWE instantly fails verification, forcing re-auth, no DB cleanup needed. `OTP_PEPPER` rotation is destructive mid-flight — unconsumed `OtpChallenge.codeHash` rows become unverifiable; rotate only with zero pending challenges | README.md "Secret rotation" `(new)` | Manual: staging drill rotates `OTP_PEPPER` mid-flight, confirms the predicted `OTP_INVALID` | Planned |
| CFG-6 | `.gitignore` covers `node_modules`, `.next`, `.env*`, `prisma/schema.sqlite.prisma`, and the SQLite fallback's `dev.sqlite` (C3, C17) | `.gitignore` | Manual: `git status` after exercising both Postgres and SQLite setups shows no stray files | Planned |
| CFG-7 | Three vars added to C16 by amendment A7, backing RATE-9/RATE-11 above: `SMS_DAILY_CAP_MINOR` and `SMS_KILL_SWITCH` are operational knobs an owner may need to flip without a redeploy; `E2E_TEST_HOOKS` gates `POST /api/test/reset` and MUST be unset/false in production | `src/lib/env.ts` Zod schema; Vercel Project Environment Variables per environment | CI step `(new)` extends CFG-2's name-diff to cover these three; RATE-11's security-suite test fails the build if `E2E_TEST_HOOKS=true` in a production environment config | Planned |

### 10.7 Transport and headers

All headers below are set in one place so no route can ship without them:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy:
  default-src 'self'; script-src 'self' 'nonce-{requestNonce}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
  connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'; upgrade-insecure-requests
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
```

`script-src` needs a per-request nonce (minted in `middleware.ts`, threaded via an `x-nonce` header into `layout.tsx`) plus `strict-dynamic`, since Next's own hydration bootstrap injects further scripts at runtime that cannot carry their own nonce. `style-src 'unsafe-inline'` is a necessary, stated relaxation: Radix primitives behind `ui/dialog`/`popover`/`select`/`tooltip`/`sheet` inject inline positioning styles that neither Radix nor FullCalendar can nonce in this stack — removing it breaks those components. `connect-src 'self'` suffices because Twilio/Upstash/Postgres are server-only (2.5). `frame-ancestors 'none'` plus `X-Frame-Options: DENY` is belt-and-suspenders against clickjacking `/admin/login`. Adding any third-party script/font/widget would violate this policy (and C18/C23's zero-third-party budget first).

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| HDR-1 | HSTS, 2-year max-age, preload | `next.config.mjs` `headers()` | Manual `curl -I` against production post-deploy | Planned |
| HDR-2 | CSP above, nonce minted per request | `next.config.mjs` + `middleware.ts` (nonce) + `layout.tsx` (reads it) | E2E asserts the header on every route (Section 3); zero devtools CSP-violation reports across a manual pass; Lighthouse CI Best Practices (C23) | Planned |
| HDR-3 | `X-Frame-Options: DENY` / `frame-ancestors 'none'` | `next.config.mjs` `headers()` | Same E2E assertion; manual clickjacking PoC against `/admin/login` confirms refusal | Planned |
| HDR-4 | `Referrer-Policy: strict-origin-when-cross-origin` — chosen because the reference lives in the success/`.ics` URL path (AUTHZ-5) | `next.config.mjs` `headers()` | E2E assertion; manual network check confirms no outbound `Referer` carries the reference | Planned |
| HDR-5 | `X-Content-Type-Options: nosniff`; `.ics` route also sets explicit `Content-Type: text/calendar; charset=utf-8` | `next.config.mjs`; `api/appointments/[reference]/ics/route.ts` | E2E assertion targeted at the `.ics` route | Planned |
| HDR-6 | `Permissions-Policy` disables every unused browser feature; `ClinicSettings.mapUrl` is a plain external link, never an embedded map | `next.config.mjs` `headers()` | E2E assertion | Planned |

### 10.8 Logging and PII

Restating C19 as controls:

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| LOG-1 | One logger (pino) with a redaction serializer wrapping every call site | `src/lib/logger.ts` | `logger.test.ts` `(new)` asserts redaction fires even for an accidental banned key | Planned |
| LOG-2 | Never logged: `phoneE164`/`holdPhoneE164`, `fullName`/`holdFullName`, `OtpChallenge.codeHash` and the raw OTP (never assigned to a loggable variable at all, C10), `AdminUser.passwordHash`/submitted password, the session cookie, `Appointment.reference`, any raw request body | `logger.ts`'s `redact` paths; action logs built from a fixed allowlist, never spread `input`/`output` | `logger.test.ts` covers the full redact list | Planned |
| LOG-3 | `phoneHash` correlation: first 8 hex chars of `HMAC-SHA256(phone, OTP_PEPPER)` — same function/pepper the rate limiter uses for hashed keys (C14), one call site not two | `src/lib/phone.ts` `hashPhone()` `(new, shared)` | `phone.test.ts`: deterministic, 8 hex chars never equal the input | Planned |
| LOG-4 | Error reporting, if ever added, must scrub request/response bodies before transmission, mirroring LOG-2. No error-reporting SaaS is in C2's stack for v1 — stated constraint for a future addition | Code comment in `logger.ts`; README note | Manual: a future PR adding such an SDK must show scrubbing before LOG-6's checkbox is checked | Planned |
| LOG-5 | Action logging is PII-free by construction: `{ action, durationMs, outcome }` only — never the parsed input (C23) | `src/server/action.ts` `defineAction` | Unit test asserts the logger receives exactly those three keys regardless of input/output | Planned |
| LOG-6 | PR template checkbox: "any new log line touching patient data reviewed for PII" | `.github/pull_request_template.md` (C17) | Procedural — human review, not an automated gate | Planned |

### 10.9 Privacy and data protection

**Minimal data**: only `fullName`/`holdFullName` and `phoneE164`/`holdPhoneE164` identify a patient anywhere in the schema (C5) — no email (`AdminUser.email` is a staff credential), no address, no clinical notes; `Appointment.adminNote` is logistics-only ("patient called to confirm," 4.3.3), never patient-visible, never diagnostic (C1 excludes EHR). **Lawful basis**: contract performance / legitimate interest in the appointment the patient is actively requesting; whether a service name counts as health-adjacent data is an open legal question (Section 1). The review step pairs its required checkbox with consent copy — *"By confirming, you agree we'll store your name and phone number to manage this appointment and send you SMS updates about it. See our Privacy Policy."* — linked to `/privacy`. **DSAR/erasure**: no patient portal exists (C1), so an operator looks up the `Patient` by phone and either exports the record (access) or runs `retention.ts`'s anonymize/delete logic immediately for that one `patientId` instead of waiting 24 months (erasure) — assumption: `retention.ts` gains an optional `--patient-id` flag. **Processors**: the hosting/Postgres provider (holds everything); Twilio (receives phone + OTP/confirmation text only, never the patient's own name); Upstash if enabled (receives only HMAC-hashed keys). Patient phone numbers leave the system **only to Twilio**. **Cookies**: exactly one, the admin session cookie, set only after admin login — the booking wizard's state lives in client state/URL, so patients get zero cookies and no consent banner is required.

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| PRIV-1 | Minimal-data argument (name + phone only) | `prisma/schema.prisma` (4) | Code review: a PR adding a new patient-facing free-text field must update this section and `/privacy` | Planned |
| PRIV-2 | Lawful basis + consent copy at the review step | `booking/components/review-step.tsx`; `app/privacy/page.tsx` | `review-step.test.tsx` (C17) asserts copy/link render, "Continue" disabled until checked | Planned |
| PRIV-3 | DSAR/erasure served operationally via an extended retention script | `scripts/retention.ts` + `--patient-id` `(new)` | Manual: operator drill against a seeded patient on a non-prod branch, within a stated SLA (e.g. 30 days) | Planned |
| PRIV-4 | Data-processor list; phone leaves the system only to Twilio | `/privacy` content; cross-checked vs. 02's External Services subgraph | Manual architecture walkthrough confirms no fourth egress path | Planned |
| PRIV-5 | Cookie inventory: one cookie, admin-only — no consent banner required | `src/auth.ts` (sole `Set-Cookie` site) | E2E `(new)`: patient flow asserts an empty cookie jar; one cookie after admin login | Planned |

**Retention schedule (C20):**

| Entity | Trigger | Action | Where |
|---|---|---|---|
| Appointment | `startsAtUtc` > 24mo old | Anonymize `holdFullName`→`"Redacted"`, `holdPhoneE164`→`"+000000000000"`; `*AtBooking` fields kept | `scripts/retention.ts`, monthly cron |
| Patient | No appointment in 24mo | Hard delete | `scripts/retention.ts`, monthly cron |
| OtpChallenge | 24h after consumed/expired | Hard delete | `scripts/retention.ts` (cadence mismatch vs. 24h target — Section 4's own Contract Challenge) |
| AuditLog | `createdAt` > 24mo | Hard delete | `scripts/retention.ts`, monthly cron |

### 10.10 Dependencies and supply chain

| ID | Control | Where implemented | How verified | Status |
|---|---|---|---|---|
| DEP-1 | Lockfile committed; CI installs `--frozen-lockfile` | `pnpm-lock.yaml` (addition to Section 3's tree) | `ci.yml` fails the build on a stale/missing lockfile | Planned |
| DEP-2 | `pnpm audit` on every PR; Dependabot weekly PRs for vulnerable/outdated deps | `ci.yml` audit step; `.github/dependabot.yml` `(new)` | CI log shows the audit step running; one-time manual check against a deliberately vulnerable test dep | Planned |
| DEP-3 | New-dependency policy: stated PR reason, check against C2's pinned stack first, prefer widely-audited packages for phone/crypto work (libphonenumber-js, `@node-rs/argon2` already meet this bar) | README.md contributing note `(new)` | Code-review convention; not automatable | Planned |
| DEP-4 | `.ics` writer is hand-rolled: RFC 5545 is small/stable and v1 needs only fixed fields, no recurrence or multi-attendee negotiation (C1) — less attack surface and zero transitive risk vs. a general calendar library | `src/lib/ics.ts` (C2) | `ics.test.ts` (C17) validates line-folding, CRLF endings, VCALENDAR/VEVENT wrapper; manual one-time import into a real calendar client | Planned |

### 10.11 Threat model summary

| Threat | Vector | Mitigation | Residual risk |
|---|---|---|---|
| Double booking | Concurrent `createBooking`/`reschedule` on overlapping intervals under READ COMMITTED | `AppointmentSlot.slotStartUtc` unique index is the atomic guard; app-level recheck only fails fast (6.4) | None at the data layer; a losing patient sees `SLOT_TAKEN` and re-picks |
| OTP brute force | Repeated `verifyOtp` guesses against one challenge | `maxAttempts=5`; `otp.verify` capped 10/15min/appointment (C14); constant-time compare | ~0.0005% success at 5 guesses over 10^6; a legitimate mistyper must request a new code |
| SMS pumping / toll fraud | Scripted `booking.create` across many numbers purely to trigger paid SMS | Per-phone/IP caps (C14); country allowlist (RATE-8); clinic-wide `otp.send.global` (200/24h) + `sms.spend.global` (`SMS_DAILY_CAP_MINOR`) ceilings and `SMS_KILL_SWITCH` (RATE-9, C14 amendment A6); unverified-ratio monitoring (RATE-10) | The global ceilings now bound aggregate exposure even across a rotated-number/SIM-farm attack, closing the gap per-key limits left open; residual risk shifts to availability — once a ceiling trips, legitimate bookings lose SMS confirmation too (they still succeed as `PENDING_VERIFICATION`, RATE-9) — and to detection latency, since RATE-10's ratio monitor is what flags a rotation attack before the ceiling itself is reached |
| Admin credential stuffing | Automated logins with breached email/password lists | Soft per-(email+IP) limit + DB-backed `lockedUntil`, surfaced as the distinct `ACCOUNT_LOCKED` code (C14; C12 amendment A4); argon2id slows offline cracking | No lockout notification to the admin (no email channel, C1); a truly stolen current password is indistinguishable from legitimate use |
| Reference enumeration | Scripted guessing of `MB-XXXXXX` | 30-symbol, 6-char keyspace (~29.4 bits, AUTHZ-5, C8 amendment A3) + `reference.lookup` capped 30/1h/IP and enforced in the page's own data loader + `noindex, nofollow`/`no-store` + uniform not-found for unknown/malformed/expired (AUTHZ-7) | The keyspace alone is modest (729,000,000 values); the rate limit is what actually makes exhaustive guessing infeasible, and the uniform not-found response denies an attacker any oracle to narrow the search. No global cross-IP cap exists on `reference.lookup`, so the residual risk is a distributed/botnet attacker spreading guesses across many IPs; even then, a successful guess discloses only one booking's logistics, never a patient record |
| PII leakage via logs | A new log line accidentally includes phone/name/token | pino redaction (LOG-1/2); PR template checkbox (LOG-6) | Keylist-based — a novel or mistyped key can still slip through; a process control, not a guarantee |
| DoS on the availability endpoint | Scripted flooding of `getAvailableDays/Slots` | `availability.read` capped 60/1min/IP; the query itself is cheap, well under the 120ms p95 budget (6.7) | `MemoryRateLimiter` is advisory-only per-instance on serverless (C14) — prod must run Upstash; volumetric DDoS is Vercel's responsibility |

#### Contract Challenges

- **C12 has no error code for "OTP resend count exceeded."** C10 caps resends at 3/challenge, but C12's closed `ErrorCode` union only has `OTP_RESEND_COOLDOWN` (the 60s timer) — a different failure. RATE-7 reuses `OTP_MAX_ATTEMPTS` as the closest fit; the contract should name this mapping explicitly or add a dedicated code.
