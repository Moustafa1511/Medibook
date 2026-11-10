## 5. API / Server Actions Spec

### 5.1 Conventions

#### Envelope

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

type ActionError = {
  code: ErrorCode;
  message: string;                        // safe, user-displayable, no PII (C19)
  fieldErrors?: Record<string, string[]>; // present only for VALIDATION_ERROR-shaped failures
};

type ErrorCode =
  | "VALIDATION_ERROR" | "RATE_LIMITED" | "SLOT_TAKEN" | "SLOT_UNAVAILABLE" | "HOLD_EXPIRED"
  | "OTP_INVALID" | "OTP_EXPIRED" | "OTP_MAX_ATTEMPTS" | "OTP_RESEND_COOLDOWN" | "OTP_SEND_FAILED"
  | "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "ACCOUNT_LOCKED" | "INVALID_TRANSITION" | "CLOSED_DAY"
  | "OUTSIDE_BOOKING_WINDOW" | "INTERNAL";
```

No action ever throws across the client boundary (C12). Every failure path below — Zod rejection, rate limit, auth, a thrown engine error, a Prisma error — resolves to `{ ok: false, error }`, never a rejected promise the client has to `catch`.

#### `defineAction`

```ts
function defineAction<TIn extends z.ZodTypeAny, TOut>(config: {
  input: TIn;
  auth: "public" | "admin";
  rateLimit?: Array<{ rule: string; keys: Array<"ip" | "phone" | "email" | "appointmentId"> }>;
  handler: (
    input: z.infer<TIn>,
    ctx: { session: AdminSession | null; clock: Clock; requestId: string },
  ) => Promise<TOut>;
}): (raw: unknown) => Promise<ActionResult<TOut>>;

type AdminSession = { adminUserId: string; role: "OWNER" | "STAFF" };
```

Fixed pipeline, same order on every call (C12):

1. **Zod parse** — `config.input.safeParse(raw)`. Failure short-circuits to `err(VALIDATION_ERROR, { fieldErrors })`; the handler never runs.
2. **Rate limit** — one `RateLimiter.limit()` call per configured rule (C14, keys HMAC-hashed). Any breach short-circuits to `err(RATE_LIMITED)`.
3. **Auth** — `"public"` is a no-op. `"admin"` calls `requireAdmin()`, which re-reads the session server-side and re-checks `AdminUser.isActive`/`lockedUntil` (C11) even though middleware already gated the route: no session -> `UNAUTHORIZED`; valid session, `isActive: false` or an insufficient role (a seam per C4, unused by any action below) -> `FORBIDDEN`; valid session, `lockedUntil` in the future -> `ACCOUNT_LOCKED` (A4) — the temporary, self-clearing lock gets its own code so the UI can say "try again in N minutes" instead of a permanent-sounding "forbidden."
4. **Handler** — feature logic, already-typed input.
5. **Error mapping** — one catch site. A typed engine error (e.g. the slot engine's `SLOT_UNAVAILABLE`) passes through as its code. A Prisma `P2002` is mapped from `meta.target`: `slotStartUtc` -> `SLOT_TAKEN`; any other unique column (`Service.slug`, `ClosedDate.date`, `Patient.phoneE164`) -> `VALIDATION_ERROR` with a `fieldErrors` entry, since the union has no per-field "already taken" code and doesn't need one. Anything unrecognized -> `INTERNAL`, logged with its stack server-side only (C19), never echoed.

Every entry in 5.2-5.9 states only what varies — `input`, `auth`, `rateLimit`, and the handler's own effects/errors — the five steps above are implied, not repeated.

#### Field errors reaching React Hook Form

`fieldErrors` keys are the same dot-paths the shared schema in `features/<f>/schemas.ts` uses (C17): the form's `@hookform/resolvers/zod` resolver and the server's `defineAction({ input })` parse the identical object, so a server-side key always matches a client field name. On `ok: false`, the submit handler runs `Object.entries(error.fieldErrors ?? {}).forEach(([k, msgs]) => form.setError(k, { type: "server", message: msgs[0] }))`; a key with no matching field, or a missing `fieldErrors` altogether, falls back to a toast built from `error.message`.

#### Identifier convention

Every action is cited as action `<feature>.<name>`, matching its `features/<feature>/actions.ts` export (C17) and the literal string `defineAction` logs in `{ action, durationMs, outcome }` (C23). **Kind: Internal** marks a server-side helper with no `"use server"` export of its own — given a dotted identifier anyway because C14 pins a rate-limit rule under that name.

#### Naming reconciliation

This section's required identifiers occasionally rename a function Section 3 or Section 6 already specified. Resolved once here, used consistently below; no silent fork:

| This section's identifier | Named elsewhere as | Fragment |
|---|---|---|
| `availability.getMonth` | `getAvailableDays` | 6 (3's comment just says "delegates to server/slots") |
| `availability.getSlots` | `getAvailableSlots` | 6 |
| `booking.create` | `createBooking` | 3, 6 |
| `otp.send` | internal only, no export | 3 |
| `otp.resend` | `resendOtp` | 3 |
| `otp.verify` | `verifyOtp` | 3 |
| `appointments.list` | `listAppointments` | 3 |
| `appointments.get` | `getAppointmentById` | 3 |
| `appointments.updateStatus` | `.confirm`/`.complete`/`.markNoShow`/`.cancel` | 3 |
| `patients.get` | not present | 3 (new) |
| `dashboard.getKpis` | `getDashboardKpis` | 3, 9 |
| `dashboard.getRevenueSeries` | `getRevenueSeries` | 3, 9 |
| `dashboard.getServiceBreakdown` | `getAppointmentsByService` | 3, 9 |
| `services.setActive` | `.deactivate` | 3 (generalized to `isActive: boolean`) |
| `services.reorder` | not present | 3 (new) |
| `settings.updateWorkingHours` | `.upsertWorkingHours` | 3 |

Separately: Section 3 marks `dashboard/` and `patients/` as "`actions.ts` omitted — read-only, `queries.ts` only." This section documents `dashboard.*`, `patients.list` and `patients.get` as full Server Actions anyway, because the admin UI's range/granularity toggles and table search/pagination (C15: `/admin`, `/admin/patients` are `searchParams`-driven) need a client-side refetch path that doesn't re-navigate. Both call sites — the initial RSC render reading `searchParams` and these actions — invoke the same `queries.ts` function; no logic forks.

#### Other input conventions assumed here (not pinned by C1-C23)

- Pagination: `page` (integer >= 1, default 1), `pageSize` (integer, 1-100, default 20).
- Date-range filters use `"YYYY-MM-DD"` clinic-local calendar strings (C5/C6 convention, same as `ClosedDate`), converted at the query boundary via `fromZonedTime`; omitted range defaults to the trailing 30 days.
- Revenue aggregates (`dashboard.*`, `patients.list`'s "total spent") sum `priceMinorAtBooking` for `COMPLETED` appointments only; `NO_SHOW` and `CANCELLED` are excluded.

#### `ErrorCode` -> HTTP-equivalent status and user message

Server Actions never set a real HTTP status (they always return `200` with the envelope); "HTTP-equivalent" is the status a Route Handler expressing the same failure would use, and the status actually used by the four real routes in 5.10.

| Code | HTTP-equiv. | User-facing message |
|---|---|---|
| `VALIDATION_ERROR` | 400 | "Please check the highlighted fields." |
| `RATE_LIMITED` | 429 | "Too many attempts. Please wait a moment and try again." |
| `SLOT_TAKEN` | 409 | "That time was just taken. Please pick another slot." |
| `SLOT_UNAVAILABLE` | 409 | "That time is no longer available. Please pick another slot." |
| `HOLD_EXPIRED` | 410 | "Your booking hold expired. Please start again." |
| `OTP_INVALID` | 400 | "That code isn't right. Please try again." |
| `OTP_EXPIRED` | 410 | "That code has expired. Request a new one." |
| `OTP_MAX_ATTEMPTS` | 429 | "Too many incorrect attempts. Request a new code." |
| `OTP_RESEND_COOLDOWN` | 429 | "Please wait before requesting another code." |
| `OTP_SEND_FAILED` | 502 | "We couldn't send that code. Please try resending." |
| `NOT_FOUND` | 404 | "We couldn't find that." |
| `UNAUTHORIZED` | 401 | "Please sign in to continue." |
| `FORBIDDEN` | 403 | "You don't have permission to do that." |
| `ACCOUNT_LOCKED` | 423 | "Account locked after repeated failed attempts. Try again in {minutesRemaining} minute(s)." |
| `INVALID_TRANSITION` | 409 | "That action isn't allowed for this appointment right now." |
| `CLOSED_DAY` | 409 | "The clinic is closed that day." |
| `OUTSIDE_BOOKING_WINDOW` | 409 | "That date is outside the booking window." |
| `INTERNAL` | 500 | "Something went wrong. Please try again." |

`ACCOUNT_LOCKED` (A4) is a permanent condition's temporary sibling, not FORBIDDEN's twin: FORBIDDEN now means only `isActive: false` or an insufficient role, conditions a user cannot wait out, while `ACCOUNT_LOCKED` means `lockedUntil` is in the future and clears itself. Its message is also the one dynamic string in this table — the handler computes `minutesRemaining = Math.ceil((lockedUntil.getTime() - clock.now().getTime()) / 60_000)` from `AdminUser.lockedUntil` (C5/C11) and substitutes it; every other row above is a fixed string. 423 ("Locked") is used as the HTTP-equivalent precisely because it is not 403 — the two codes must stay distinguishable end to end.

### 5.2 Public booking and availability

The step-1 service picker on `/book` is served by `getBookableServices()` (`features/booking/queries.ts`, 3) read at the same build-time boundary as `/` (C15) — not a Server Action, out of scope here.

#### `availability.getMonth`

Server Action | Auth: public | Rate limit: `availability.read` — 60/1 min per IP (C14)

```ts
const GetMonthInput = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  serviceId: z.string().cuid(),
});
```
```ts
type GetMonthOutput = { disabledDates: string[] }; // "YYYY-MM-DD"[], feeds react-day-picker's Matcher
```

Side effects: none; delegates to `getAvailableDays` (6.2), cached settings/hours/closed-dates per request (C23 `cache()`).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | malformed `yearMonth`, inactive/unknown `serviceId` | inline form error |
| `RATE_LIMITED` | > 60 req/min from one IP | retry after backoff, no toast spam |

Idempotency: naturally idempotent (pure read).

#### `availability.getSlots`

Server Action | Auth: public | Rate limit: `availability.read` — 60/1 min per IP (C14)

```ts
const GetSlotsInput = z.object({
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().cuid(),
});
```
```ts
type GetSlotsOutput = {
  slots: Array<{ startUtc: string; endUtc: string; displayLocal: string }>; // ISO instants
};
```

Side effects: opens its own transaction; runs the hold-expiry sweep (C9 step 5) before reading, so a slot freed a moment ago is already offered (6.3).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | malformed date, inactive/unknown service | inline error, step blocked |
| `RATE_LIMITED` | burst polling | silent backoff |

Idempotency: idempotent; result reflects only committed state at call time (invariant 6.1-1 — never a reservation).

#### `booking.create`

Server Action | Auth: public | Rate limit: `booking.create` — 5/1h per phone AND 20/1h per IP (C14)

```ts
// Accepts: letters incl. Latin-1 accented (À-ÖØ-öø-ÿ, excluding the non-letter codepoints
// × U+00D7 / ÷ U+00F7 inside that block), space, hyphen, straight/curly apostrophe — but only
// as interior characters, since first/last must be a letter. Rejects: leading/trailing space-
// hyphen-apostrophe, all-punctuation strings ("--"), digits, underscores, non-Latin scripts
// (Cyrillic, CJK, Arabic) — a known v1 gap per C1's no-i18n scope.
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ](?:[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]{0,78}[A-Za-zÀ-ÖØ-öø-ÿ])?$/;
const FullName = z.string().trim().min(2).max(80).regex(NAME_PATTERN);

// libphonenumber-js has no native Zod integration; transform (not refine) so the raw national-
// format input the phone widget produces is normalized to E.164 before it reaches
// Patient.phoneE164 / Appointment.holdPhoneE164. CLINIC_DEFAULT_COUNTRY (C16) seeds the
// assumed country when the user doesn't type a leading "+".
const PhoneE164 = z.string().transform((raw, ctx) => {
  try {
    const parsed = parsePhoneNumberWithError(raw, env.CLINIC_DEFAULT_COUNTRY as CountryCode);
    if (!parsed.isValid()) throw new Error("invalid");
    return parsed.number; // "+491701234567"
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number." });
    return z.NEVER;
  }
});

const CreateBookingInput = z.object({
  serviceId: z.string().cuid(),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startUtc: z.string().datetime(),
  fullName: FullName,
  phoneE164: PhoneE164,
  confirmReview: z.literal(true), // step 5's checkbox
});
```
```ts
type CreateBookingOutput = { appointmentId: string; reference: string }; // "MB-XXXXXX", C8
```

Side effects (6.4, 2.4): one `$transaction` — sweep, re-check availability (client's chosen slot is never trusted as-is), insert `Appointment(status: "PENDING_VERIFICATION", holdExpiresAt, patientId: null)` plus one `AppointmentSlot` row per occupied interval. After commit: generate+retry the reference (up to 5x, C8), create `OtpChallenge`, call `otp.send` (5.3.1) — SMS failure does not roll back the hold.

Assumption (reconciling C12's closed-day/window codes with 6.2/6.4's pseudocode, which folds everything into one `SLOT_UNAVAILABLE` throw at the match step): the handler first classifies `dateLocal` using the same day-level reasons `getAvailableDays` computes (6.2 step 9) *before* calling `getFreeSlotsInTx` — `CLOSED_DATE`/`NO_WORKING_HOURS` -> `CLOSED_DAY`, `BEYOND_WINDOW` -> `OUTSIDE_BOOKING_WINDOW` — so the UI can say "closed that day" rather than the generic "pick another slot." `PAST`/`LEAD_TIME`/`FULLY_BOOKED` fall through to the normal slot match, which yields `SLOT_UNAVAILABLE` if nothing matches.

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | bad name/phone/ids, `confirmReview` not `true` | inline field errors |
| `RATE_LIMITED` | phone or IP bucket exceeded | "too many attempts" toast, step 5 stays |
| `CLOSED_DAY` | date is a `ClosedDate` or has no `WorkingHour` rows | step 2 refetches `availability.getMonth` |
| `OUTSIDE_BOOKING_WINDOW` | date beyond `maxAdvanceDays` | step 2 refetches `availability.getMonth` |
| `SLOT_UNAVAILABLE` | re-check finds no match (taken/lead-time/fully booked) | step 3 refetches `availability.getSlots` |
| `SLOT_TAKEN` | `P2002` on `AppointmentSlot.slotStartUtc` | same as above — loser of the race |
| `OTP_SEND_FAILED` | `SmsProvider.sendOtp` failed, booking already committed | OTP screen shown anyway, with "Resend" |

Idempotency: not idempotent — each successful call creates one `Appointment`. No idempotency key in v1; double-submit is prevented only client-side (disabled button during the pending request), a stated gap.

#### `booking.getByReference`

Server Action | Auth: public | Rate limit: `reference.lookup` — 30/1h per IP (C14), one bucket per IP shared with the success page's data loader (below) and the `.ics` route (5.10.2) — spreading requests across the three surfaces buys an attacker no extra budget (A5)

```ts
const GetByReferenceInput = z.object({ reference: z.string().regex(/^MB-[2-9A-HJKMNP-TV-Z]{6}$/) });
```
```ts
type GetByReferenceOutput = {
  reference: string; status: AppointmentStatus; startsAtUtc: string; endsAtUtc: string;
  serviceNameAtBooking: string; priceMinorAtBooking: number; currencyAtBooking: string;
};
```

Side effects: none; normalizes to uppercase before lookup (C8). A match whose `status` is `CANCELLED` with `cancellationReason: "HOLD_EXPIRED"` (C9 step 5 — the hold lapsed before the patient ever confirmed) is treated as `NOT_FOUND`, not returned as data: that reference never reached a state worth disclosing. Any other resolved status (`PENDING_VERIFICATION`, `CONFIRMED`, `COMPLETED`, an admin-initiated `CANCELLED`, `NO_SHOW`) is returned as-is. Backs `/book/success/[reference]`'s client-side refetch and the `.ics` route's own lookup (5.10.2); the page's *initial* SSR render calls this same handler directly rather than a separate query function (below) — one code path, one rate-limit bucket, one not-found view.

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | malformed reference shape | the same not-found view as `NOT_FOUND` below, word-for-word (A5): "We couldn't find that booking." — never 5.1's default "Please check the highlighted fields," since there is no field to highlight |
| `NOT_FOUND` | no matching row, or a match whose hold expired before confirmation (above) | "We couldn't find that booking." |
| `RATE_LIMITED` | > 30/h from one IP (shared bucket) | retry later |

Idempotency: idempotent.

#### Token-resolving page: `/book/success/[reference]` (A5)

Not a Server Action and not one of 5.10's Route Handlers — C13/C15 had no category for a page that resolves a capability token, so A5 classifies it as a third kind, a **token-resolving page**, with these mandatory properties:

- Dynamic SSR, `Cache-Control: no-store`, `robots: noindex, nofollow` (C15) — a capability-token response must never be cached or indexed.
- Its data loader *is* the `booking.getByReference` handler above, called directly from the Server Component rather than through a separate `queries.ts` function — so the `reference.lookup` limit, the Zod shape check, and the uniform not-found behavior all apply to the very first request for a given IP, not only to a later client refetch.
- An unknown reference, a malformed reference, and an expired-hold reference (the same three cases as `booking.getByReference` above and the `.ics` route at 5.10.2) render the identical not-found view, with no wording or timing difference the visitor could use to tell the three apart (A5) — one query, one status check, one rendered outcome for all three.

### 5.3 OTP

#### `otp.send`

**Kind: Internal** (invoked by `booking.create`'s post-commit step, C9.3, and reused by `otp.resend`) | Rate limit rule name: `otp.send` — 3/15 min per phone AND 10/1h per IP (C14), enforced at each call site, not independently; plus two clinic-wide ceilings shared across every phone number (A6): `otp.send.global` — 200 sends per rolling 24h, and `sms.spend.global` — a rolling-24h spend cap at `SMS_DAILY_CAP_MINOR` minor units (C16)

```ts
function sendOtp(tx: Tx, appointmentId: string, phoneE164: string, clock: Clock): Promise<void>;
```

(C14 names a rate-limit rule `otp.send` for an operation with no standalone export — see Contract Challenges at the end of this file.)

Side effects: checks `SMS_KILL_SWITCH` (C16/A6) first — if `"true"`, short-circuits immediately with `OTP_SEND_FAILED`, generating no code and touching no `OtpChallenge` row, for use during an active attack. Otherwise checks the two global ceilings, `otp.send.global` and `sms.spend.global` (A6); breaching either stops the send, returns `OTP_SEND_FAILED`, emits a `CRITICAL`-level log event (C19 — no PII, just the breached rule and current count), and raises a persistent banner on the admin dashboard. None of this touches the booking itself: the `Appointment` stays `PENDING_VERIFICATION` and its `AppointmentSlot` rows stay held, so clinic staff can confirm the booking by hand once sending resumes — a clinic-wide ceiling never cancels a hold (A6). Past that gate: `crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits; HMAC-SHA256 with `OTP_PEPPER` -> `codeHash`; upserts the `OtpChallenge` row (`expiresAt = now + 5min`, C10); calls `SmsProvider.sendOtp`. Runs outside the booking's own transaction (6.4) — a send failure never un-commits the hold.

| Code | Trigger | UI handling |
|---|---|---|
| `OTP_SEND_FAILED` | `SmsProvider` call rejects/times out; `SMS_KILL_SWITCH="true"`; `otp.send.global` or `sms.spend.global` ceiling breached (A6) | caller surfaces this to its own client; "Resend" offered — the booking stays `PENDING_VERIFICATION`, never lost |

Idempotency: not idempotent — always mutates `codeHash`/`expiresAt` and sends a fresh code, except on the kill-switch/ceiling short-circuit above, which mutates nothing.

#### `otp.resend`

Server Action | Auth: public | Rate limit: `otp.send` rule — 3/15 min per phone AND 10/1h per IP (C14), plus the DB-backed cooldown below, plus the same two clinic-wide ceilings and `SMS_KILL_SWITCH` as `otp.send` (A6) — a resend is just another `otp.send` call and shares its global budget, not a separate one

```ts
const ResendInput = z.object({ appointmentId: z.string().cuid() });
```
```ts
type ResendOutput = { expiresAt: string };
```

Side effects: enforces C10's 60s cooldown and 3-resend cap from `OtpChallenge.lastSentAt`/`resendCount` (authoritative, DB-backed — not the per-instance `RateLimiter`, per C14's serverless caveat); on success calls `otp.send` (resets `attempts` to 0, increments `resendCount`, extends `expiresAt`). A kill-switch or global-ceiling failure inside that call (A6) still counts as a used resend — `resendCount` increments the same as for any other `OTP_SEND_FAILED` — since a resend was genuinely attempted, matching C9's existing "SMS failure does not roll back" treatment.

| Code | Trigger | UI handling |
|---|---|---|
| `OTP_RESEND_COOLDOWN` | < 60s since `lastSentAt` | disable button, show countdown |
| `RATE_LIMITED` | per-instance bucket breached | same as cooldown |
| `NOT_FOUND` | unknown `appointmentId`, or challenge already consumed/dead (3 resends used, or `maxAttempts` reached) | "Please start a new booking." |
| `OTP_SEND_FAILED` | SMS send failed, including a clinic-wide ceiling breach or `SMS_KILL_SWITCH` (A6) | "Resend" stays available (bounded by `resendCount`) |

Idempotency: not idempotent by design (always a new code); safe to retry on network failure — a lost response just prompts another resend, bounded by the cap.

#### `otp.verify`

Server Action | Auth: public | Rate limit: `otp.verify` — 10/15 min per appointment (C14)

```ts
const VerifyInput = z.object({
  appointmentId: z.string().cuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});
```
```ts
type VerifyOutput = { appointmentId: string; reference: string; status: "CONFIRMED" };
```

Side effects (C9 step 4): constant-time compare of `HMAC(code, OTP_PEPPER)` against `codeHash`. Mismatch increments `attempts`; hitting `maxAttempts` kills the challenge. Match, in one transaction: upsert `Patient` by `phoneE164` (updates `fullName`), update `Appointment` (`status: "CONFIRMED"`, `verifiedAt`, `confirmedAt`, `patientId`, `holdExpiresAt: null`), set `OtpChallenge.consumedAt`. After commit, fire-and-forget `SmsProvider.sendConfirmation` (failure not surfaced — same non-blocking treatment C9 gives the OTP send itself, assumed symmetric).

Note (C10): a verify against an already-`consumedAt` challenge returns `OTP_EXPIRED`, not `NOT_FOUND` — C10 groups the already-consumed case with expired/dead challenges under `OTP_EXPIRED`/`OTP_MAX_ATTEMPTS`, so a double-submit (double-tap on Verify, or a stale tab reopened after confirming in another tab) gets the same "request a new code" response as a genuinely expired challenge, never revealing that the code had in fact already succeeded. (`otp.resend`'s own consumed/dead handling at 5.3's `otp.resend` is unaffected — C10 pins this only for the verify attempt itself.)

| Code | Trigger | UI handling |
|---|---|---|
| `OTP_INVALID` | hash mismatch, attempts remain | inline error, attempts counter shown |
| `OTP_EXPIRED` | `now > expiresAt`, or challenge already `consumedAt` (C10) | "Request a new code" (resend) |
| `OTP_MAX_ATTEMPTS` | increment reaches `maxAttempts` (5) | "Request a new code" (resend) |
| `HOLD_EXPIRED` | `Appointment.holdExpiresAt` passed, not yet swept (6.6) | restart booking |
| `NOT_FOUND` | unknown id | restart or re-check success page |
| `RATE_LIMITED` | > 10/15min for this appointment | brief lockout message |

Idempotency: a second call with the correct code after success returns `OTP_EXPIRED` (consumed, per C10); never double-confirms or double-upserts `Patient`.

### 5.4 Admin auth

#### `adminAuth.login`

Server Action | Auth: public (pre-session) | Rate limit: `admin.login` — 5/15 min per (email+IP) (C14), plus `AdminUser.lockedUntil = now + 15min` after 5 consecutive DB-tracked failures

```ts
const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});
```
```ts
type LoginOutput = { redirectTo: string }; // e.g. "/admin"; the session cookie itself is Auth.js's side effect
```

Thin wrapper around Auth.js `signIn("credentials", ...)` (3). Side effects: `@node-rs/argon2` verify against `passwordHash`; success -> Auth.js issues the JWE session cookie (C11), `AdminUser.lastLoginAt`/`failedLoginCount = 0`, `AuditLog` `ADMIN_LOGIN_SUCCEEDED`; failure -> `failedLoginCount += 1`, `AuditLog` `ADMIN_LOGIN_FAILED`, and if that increment reaches 5, `lockedUntil = now + 15min` is set in the same update and this response itself is reported as `ACCOUNT_LOCKED` (A4), not `UNAUTHORIZED` — the account is locked as of this very call, so the locked-account message is the accurate one to show immediately.

Stated trade-off: unknown email and wrong password both return the same `UNAUTHORIZED` message (no enumeration), but a *locked* real account returns a distinctly-worded `ACCOUNT_LOCKED` (A4) before the password is even checked — a deliberate, small enumeration leak (lockout clarity for genuine users) accepted since C11/C14 don't mandate strict non-enumeration. A *deactivated* account (`isActive: false`) is a separate, permanent case and still returns `FORBIDDEN` — A4 narrows `FORBIDDEN` to exactly that and an insufficient role; it no longer covers the temporary lock.

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | malformed email/password shape | inline field errors |
| `UNAUTHORIZED` | unknown email or wrong password | generic "Invalid email or password" |
| `FORBIDDEN` | `isActive: false` | "This account has been deactivated. Please contact the clinic owner." |
| `ACCOUNT_LOCKED` | `lockedUntil` in the future, checked before the password (whether set by an earlier attempt or by this one hitting the 5th failure) | "Account locked after repeated failed attempts. Try again in {minutesRemaining} minute(s)." (A4) |
| `RATE_LIMITED` | bucket breached | "Too many attempts" |

Idempotency: not idempotent (mutates counters each call); safe to retry on a dropped response — the cookie Auth.js sets is simply re-set.

### 5.5 Appointments (admin)

Auth: `admin` on every action in this subsection; rate limit: none pinned by C14 (session-gated surface, not a public attack target).

#### `appointments.list`

```ts
const AppointmentsFiltersInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),           // matches holdFullName/Patient.fullName or reference
  status: z.enum(["PENDING_VERIFICATION", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  serviceId: z.string().cuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```
```ts
type AppointmentsListOutput = { rows: AppointmentRow[]; total: number; page: number; pageSize: number };
```

Side effects: none. Backs `/admin/appointments`'s client-side refetch on top of the `searchParams`-driven SSR shell (C15).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | bad filter shape | reset to defaults |
| `UNAUTHORIZED` / `FORBIDDEN` / `ACCOUNT_LOCKED` | no/invalid, inactive, or locked admin session | redirect to `/admin/login` |

Idempotency: idempotent.

#### `appointments.get`

```ts
const GetAppointmentInput = z.object({ appointmentId: z.string().cuid() });
```
```ts
type AppointmentDetail = AppointmentRow & { adminNote: string | null; auditEntries: AuditLogRow[] };
```

| Code | Trigger | UI handling |
|---|---|---|
| `NOT_FOUND` | unknown id | redirect to list, toast |
| `UNAUTHORIZED` / `FORBIDDEN` / `ACCOUNT_LOCKED` | session invalid, inactive, or locked | redirect to login |

Idempotency: idempotent.

#### `appointments.updateStatus`

Funnels the table row buttons (confirm/complete/no-show/cancel) through one action and `server/appointments/transitions.ts`'s guard (C4):

```ts
const UpdateStatusInput = z.object({
  appointmentId: z.string().cuid(),
  toStatus: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  reason: z.string().max(200).optional(), // meaningful only when toStatus === "CANCELLED"
});
```
```ts
type UpdateStatusOutput = { appointmentId: string; status: string; updatedAt: string };
```

Side effects: `UPDATE Appointment` (status + the matching terminal timestamp: `confirmedAt`/`completedAt`/`cancelledAt`); on `-> CANCELLED`, `DELETE AppointmentSlot` rows for this appointment (frees the slot, mirrors the sweep; `COMPLETED`/`NO_SHOW` retain them, C5); `INSERT AuditLog { action: "APPOINTMENT_STATUS_CHANGED", metaJson: {fromStatus, toStatus} }` (no PII, C19).

Legal `toStatus` targets enforced by `transitions.ts` per C4: from `CONFIRMED` -> any of `COMPLETED`/`CANCELLED`/`NO_SHOW`; from `PENDING_VERIFICATION` -> `CANCELLED` only (admin cancels an outstanding hold directly, `cancellationReason: "ADMIN_CANCELLED"`, distinct from the sweep's `"HOLD_EXPIRED"`). All other pairs, including anything targeting `CONFIRMED` from `PENDING_VERIFICATION` (that transition is OTP-verification-only per C4) or any transition out of a terminal status, are rejected.

| Code | Trigger | UI handling |
|---|---|---|
| `NOT_FOUND` | unknown id | toast, row removed from view |
| `INVALID_TRANSITION` | pair not in the table above | toast naming the current status |
| `VALIDATION_ERROR` | bad `toStatus` value | should not occur past the dropdown; defensive only |

Idempotency: safe to retry — a repeated call against an already-terminal status fails `INVALID_TRANSITION` rather than re-firing the audit row or re-deleting already-gone slots.

#### `appointments.reschedule`

```ts
const RescheduleInput = z.object({
  appointmentId: z.string().cuid(),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startUtc: z.string().datetime(), // re-selected via availability.getSlots for the new date
});
```
```ts
type RescheduleOutput = { appointmentId: string; startsAtUtc: string; endsAtUtc: string };
```

Delegates verbatim to 6.5: row-locks the appointment, requires `status === "CONFIRMED"`, sweeps, re-checks the new slot, deletes old `AppointmentSlot` rows then inserts new ones, updates `Appointment` (`rescheduledFromUtc`), writes `AuditLog { action: "APPOINTMENT_RESCHEDULED", metaJson: {fromUtc, toUtc} }`.

| Code | Trigger | UI handling |
|---|---|---|
| `NOT_FOUND` | unknown id | toast |
| `INVALID_TRANSITION` | status is not `CONFIRMED` | toast naming current status |
| `SLOT_UNAVAILABLE` | re-check finds no match at `startUtc` | reopen slot picker |
| `SLOT_TAKEN` | `P2002` collision on insert | reopen slot picker |

Idempotency: idempotent only when retried against the *same* `startUtc` it already moved to (delete-then-reinsert of this appointment's own keys is self-consistent); retried against a now-stale `startUtc` after a prior success fails `SLOT_UNAVAILABLE`.

#### `appointments.createByAdmin`

```ts
const CreateByAdminInput = z.object({
  serviceId: z.string().cuid(),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startUtc: z.string().datetime(),
  fullName: FullName,
  phoneE164: PhoneE164,
  source: z.enum(["ADMIN", "PHONE"]).default("ADMIN"),
});
```
```ts
type CreateByAdminOutput = { appointmentId: string; reference: string };
```

Assumption: an admin-created appointment skips OTP entirely (the admin is the trusted verifier) — same slot-matching and insert path as `booking.create` (6.4), but `status: "CONFIRMED"` directly, `patientId` resolved via the same upsert-by-`phoneE164` `otp.verify` uses (C9 step 4), `confirmedAt: now`, no `OtpChallenge` row. `AuditLog { action: "APPOINTMENT_CREATED_BY_ADMIN" }` (C4).

| Code | Trigger | UI handling |
|---|---|---|
| `SLOT_TAKEN` / `SLOT_UNAVAILABLE` | same as `booking.create` | reopen slot picker |
| `VALIDATION_ERROR` | bad name/phone/ids | inline field errors |

Idempotency: not idempotent (creates a new row each call); no idempotency key, same stated gap as `booking.create`.

#### `appointments.setNote`

```ts
const SetNoteInput = z.object({
  appointmentId: z.string().cuid(),
  note: z.string().max(2000).trim().optional().transform((v) => v || null),
});
```
```ts
type SetNoteOutput = { appointmentId: string; adminNote: string | null };
```

Side effects: `UPDATE Appointment.adminNote` only. No `AuditLog` row — C4's `AuditAction` union has no note-change entry, and a free-text internal note isn't the audit trail's concern here.

| Code | Trigger | UI handling |
|---|---|---|
| `NOT_FOUND` | unknown id | toast |

Idempotency: fully idempotent (last-write-wins).

### 5.6 Patients (admin, read-only — C1)

Auth: `admin` | Rate limit: none pinned (session-gated).

#### `patients.list`

```ts
const PatientsFiltersInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(), // matches fullName or a phoneE164 prefix
});
```
```ts
type PatientsListOutput = { rows: PatientRow[]; total: number; page: number; pageSize: number };
// PatientRow: visit count, total spent (COMPLETED only, 5.1), last visit date
```

| Code | Trigger | UI handling |
|---|---|---|
| `UNAUTHORIZED` / `FORBIDDEN` / `ACCOUNT_LOCKED` | session invalid, inactive, or locked | redirect to login |

Idempotency: idempotent.

#### `patients.get`

```ts
const GetPatientInput = z.object({ patientId: z.string().cuid() });
```
```ts
type PatientDetail = PatientRow & { appointments: AppointmentRow[] };
```

| Code | Trigger | UI handling |
|---|---|---|
| `NOT_FOUND` | unknown id | redirect to list |

Idempotency: idempotent.

### 5.7 Dashboard (admin, read-only)

Auth: `admin` | Rate limit: none pinned; budget is `< 400ms p95` per C23, excluded from the booking-path budget.

#### `dashboard.getKpis`

```ts
const DateRangeInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((r) => r.from <= r.to, { message: "'from' must not be after 'to'.", path: ["from"] });
```
```ts
// Canonical shape per Section 9 (`features/dashboard/types.ts`, C17) — cited here, not redefined
// (5.1 Naming Reconciliation).
type KpiSnapshot = {
  totalPatients: number;
  totalRevenueMinor: number;
  expectedRevenueMinor: number;
  todaysAppointments: number;
  upcomingThisWeek: number;
};
```

Side effects: none; delegates to `getDashboardKpis` (9.10).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | `from` after `to`, malformed dates | reset to default 30-day range |

Idempotency: idempotent.

#### `dashboard.getRevenueSeries`

```ts
const RevenueSeriesInput = DateRangeInput.extend({ granularity: z.enum(["day", "week", "month"]).default("day") });
```
```ts
// Canonical shape per Section 9 (`features/dashboard/types.ts`, C17).
type RevenuePoint = { bucketKey: string; bucketLabel: string; revenueMinor: number };
```

Output: `RevenuePoint[]`; delegates to `getRevenueSeries` (9.7/9.9). Same error table as `getKpis`.

#### `dashboard.getServiceBreakdown`

```ts
const ServiceBreakdownInput = DateRangeInput;
```
```ts
// Canonical shape per Section 9 (`features/dashboard/types.ts`, C17).
type ServiceBreakdownPoint = { serviceId: string; serviceName: string; colorHex: string; count: number };
```

Output: `ServiceBreakdownPoint[]`; delegates to `getAppointmentsByService` (9.8). Same error table as `getKpis`.

### 5.8 Services (admin)

Auth: `admin` | Rate limit: none pinned.

#### `services.list`

```ts
const ListServicesInput = z.object({ includeInactive: z.boolean().default(false) });
```
Output: `ServiceRow[]`.

#### `services.create`

```ts
const ServiceInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  description: z.string().max(500).optional(),
  durationMin: z.number().int().min(5).max(480),
  priceMinor: z.number().int().min(0),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sortOrder: z.number().int().min(0).default(0),
});
```
Output: `ServiceRow`.

Side effects: `INSERT Service(isActive: true)`; `AuditLog SERVICE_CREATED`; `revalidatePath('/')` (C15's SSG tension — Services feed the landing page and `/book` step 1).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | bad shape, or `P2002` on `slug` mapped to a field error | inline field errors (`fieldErrors.slug`) |

Idempotency: not idempotent (creates a row).

#### `services.update`

Same `ServiceInput` (partial) + `id: z.string().cuid()`. Side effects: `UPDATE Service`, `AuditLog SERVICE_UPDATED`, `revalidatePath('/')`. `durationMin`/`priceMinor` changes never retroactively touch existing `Appointment` rows (`...AtBooking` snapshots, C5). Idempotency: idempotent (same input -> same state).

#### `services.setActive`

```ts
const SetActiveInput = z.object({ id: z.string().cuid(), isActive: z.boolean() });
```
Output: `ServiceRow`. Side effects: `UPDATE Service.isActive`; `AuditLog SERVICE_DEACTIVATED` when `isActive: false`, `AuditLog SERVICE_REACTIVATED` when `isActive: true` (C4, as amended by A1 — the union now carries a counter-operation for both directions); `revalidatePath('/')`. Deactivating a service already in future `CONFIRMED` appointments does not touch them (6.6).

Idempotency: idempotent.

#### `services.reorder`

```ts
const ReorderInput = z.object({
  items: z.array(z.object({ id: z.string().cuid(), sortOrder: z.number().int().min(0) })).min(1).max(100),
});
```
Output: `ServiceRow[]`. Side effects: one transaction, one `UPDATE` per row; no `AuditLog` entry (same C4 gap as above); `revalidatePath('/')`. Idempotency: idempotent.

### 5.9 Settings (admin)

Auth: `admin` | Rate limit: none pinned.

#### `settings.get`

No input. Output: `ClinicSettingsView` — composes `getClinicSettings()`, `listWorkingHours()`, `listClosedDates()` (3) into one payload for the settings page's three forms.

#### `settings.update`

```ts
const SettingsInput = z.object({
  clinicName: z.string().trim().min(1).max(120),
  timeZone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz)),
  currency: z.string().regex(/^[A-Z]{3}$/),
  slotIntervalMin: z.number().int().min(5).max(120),
  bufferMin: z.number().int().min(0).max(120),
  minLeadTimeMin: z.number().int().min(0).max(1440),
  maxAdvanceDays: z.number().int().min(1).max(365),
  holdTtlMin: z.number().int().min(1).max(60),
  phoneE164: PhoneE164,
  email: z.string().email(),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  mapUrl: z.string().url().optional(),
});
```
Output: `ClinicSettingsView`. Side effects: `UPDATE ClinicSettings` (singleton `id: "singleton"`, C5); `AuditLog SETTINGS_UPDATED`; `revalidatePath('/')` (`clinicName`/currency formatting are landing-visible).

Note: changes to `slotIntervalMin`/`bufferMin`/`minLeadTimeMin`/`maxAdvanceDays` take effect immediately on the next availability read — no transition period, by design (effective-immediately config, not a versioned setting).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | any field out of range, unsupported `timeZone` | inline field errors |

Idempotency: idempotent.

#### `settings.updateWorkingHours`

```ts
const WorkingHoursInput = z.object({
  weekday: z.number().int().min(0).max(6),
  shifts: z.array(z.object({
    openMinute: z.number().int().min(0).max(1439),
    closeMinute: z.number().int().min(0).max(1439),
  })).max(4),
}).refine((v) => v.shifts.every((s) => s.closeMinute > s.openMinute), { message: "Close must be after open." });
```
Output: `{ weekday: number; shifts: Array<{ openMinute: number; closeMinute: number }> }`. Replace-all-shifts-for-that-weekday semantics (matches `@@unique([weekday, openMinute])`, C5): one transaction, `DELETE WorkingHour WHERE weekday = ...` then `INSERT` the submitted shifts. `AuditLog SETTINGS_UPDATED` (reused — no dedicated working-hours action in C4).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | `closeMinute <= openMinute`, overlapping shifts, > 4 shifts | inline error naming the offending shift |

Idempotency: fully idempotent (replace-set).

#### `settings.addClosedDate`

```ts
const AddClosedDateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});
```
Side effects: `INSERT ClosedDate` (`P2002` on duplicate `date` mapped to `fieldErrors.date`); `AuditLog CLOSED_DATE_ADDED`. Existing `CONFIRMED` bookings on that date are untouched (6.6).

| Code | Trigger | UI handling |
|---|---|---|
| `VALIDATION_ERROR` | malformed date, or already closed | inline field error |

Idempotency: not idempotent on the happy path (second call for the same date fails `VALIDATION_ERROR`, which is itself an idempotent *result*).

#### `settings.removeClosedDate`

```ts
const RemoveClosedDateInput = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
```
Side effects: `DELETE ClosedDate WHERE date = ...`. Assumption: removing an already-absent date is a silent success (not `NOT_FOUND`) — deleting something already gone isn't worth surfacing as an error; `AuditLog CLOSED_DATE_REMOVED` is written only when a row was actually deleted, to avoid phantom entries.

Idempotency: fully idempotent.

### 5.10 Route Handlers (C13's closed list of four production routes, plus one non-production-only route added by A6b)

Route Handlers sit outside `defineAction`; they set real HTTP status codes and are not wrapped in `ActionResult` (C12/C13).

#### `GET/POST /api/auth/[...nextauth]`

Auth.js-internal catch-all (session fetch, CSRF token issuance, credentials callback, sign-out). Auth: Auth.js's own flow. Rate limit: not pinned by C14 — flagged in the Error-handling note below as the one gap in that table; the credentials-callback sub-route is the one that actually checks a password, and reusing `admin.login`'s bucket (5/15min per email+IP) there is this section's recommendation, not a resolved rule. Side effects: sets/clears the `__Secure-authjs.session-token` cookie (C11). Idempotency: `GET` idempotent; the credentials `POST` is not — it's the wire-level route `adminAuth.login` (5.4) wraps.

#### `GET /api/appointments/[reference]/ics`

Auth: none — the reference is the capability token (C8). Rate limit: `reference.lookup` — 30/1h per IP (C14), the same shared bucket as `booking.getByReference` (5.2) and the success page's loader (5.2) — no extra budget from spreading requests across the three (A5). Input: path param `reference`, normalized uppercase. Output on success: `200`, `Cache-Control: no-store` (A5 — a capability-token response must never be cached), `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="medibook-<reference>.ics"`, body from `lib/ics.ts`'s RFC 5545 writer over `startsAtUtc`/`endsAtUtc`/`serviceNameAtBooking`. `404`, with an identical body and no wording or timing difference (A5), for all three non-resolving cases: a malformed `reference` shape, an unknown `reference`, and a `reference` that resolves to `PENDING_VERIFICATION`/`CANCELLED`/`NO_SHOW` (including a hold that expired before confirmation, 5.2) — assumption: only `CONFIRMED`/`COMPLETED` get a calendar file, there's no event to add otherwise. `429` on rate-limit breach. Idempotency: idempotent.

#### `POST /api/cron/expire-holds`

Auth: `Authorization: Bearer <CRON_SECRET>` (C16), constant-time compare; else `401`. Rate limit: none — the secret is the guard (2.1). Input: empty body. Output: `200 { sweptCount: number }` plain JSON. Side effects: the same sweep as 6.3's lazy pass (`UPDATE` expired `PENDING_VERIFICATION` -> `CANCELLED`/`"HOLD_EXPIRED"`, `DELETE` their `AppointmentSlot` rows) run standalone, every 5 minutes (C9 step 5, `vercel.json`). Idempotency: fully idempotent — a hold already swept by either path is no longer `PENDING_VERIFICATION`, so re-running (or Vercel Cron's at-least-once delivery) finds nothing left to sweep.

#### `GET /api/health`

Auth: none. Rate limit: none. Output: `200 { status: "ok" }`. Deliberately does not touch the database — a liveness probe only, so it leaks no connectivity or schema detail to an unauthenticated caller (C13). Idempotency: idempotent.

#### `POST /api/test/reset` (A6b — non-production only; **not part of the production surface**)

Registered only when both `NODE_ENV !== "production"` AND `E2E_TEST_HOOKS === "true"` (C16/A7) hold; if either condition fails the route is never registered at all — there is no handler to 404 or 401 from, it simply does not exist on the server, which is what the security-suite assertion below actually checks. Auth: none beyond that two-condition guard — the route exists specifically to bypass the limits below for tests, so an auth check would defeat its purpose. Rate limit: none, for the same reason. Input: empty body. Output: `200 { ok: true }`. Side effects: calls the `RateLimiter`'s `resetAll()` (C14) to clear every in-memory sliding-window bucket, and resets every `AdminUser.failedLoginCount` to `0` and `lockedUntil` to `null` — both are needed because `admin.login`'s 5/15min bucket (C14) and the DB-backed lockout (C11) would otherwise make the required E2E scenarios E3/E6 (11) fail on a second same-day CI run (A6b). Called by Playwright's global setup and between the specs that exercise limits (11). A security-suite test (10/11) asserts this route is absent from a production build. It must never be used to weaken a production limit — it exists only so CI can re-run deterministically, not as a path available to staging or production.

### 5.11 Error-handling matrix and CSRF

| Code | Emitted by |
|---|---|
| `VALIDATION_ERROR` | any action, on input-parse failure; also `services.create`/`.update`, `settings.addClosedDate` (unique-constraint-as-field-error) |
| `RATE_LIMITED` | `availability.getMonth`/`getSlots`, `booking.create`, `otp.send`/`.resend`/`.verify`, `adminAuth.login`, the success page's loader and `.ics` route (shared `reference.lookup` bucket, A5) |
| `SLOT_TAKEN` | `booking.create`, `appointments.reschedule`, `appointments.createByAdmin` |
| `SLOT_UNAVAILABLE` | `booking.create`, `appointments.reschedule`, `appointments.createByAdmin` |
| `HOLD_EXPIRED` | `otp.verify` |
| `OTP_INVALID` | `otp.verify` |
| `OTP_EXPIRED` | `otp.verify` |
| `OTP_MAX_ATTEMPTS` | `otp.verify` |
| `OTP_RESEND_COOLDOWN` | `otp.resend` |
| `OTP_SEND_FAILED` | `otp.send` (surfaced via `booking.create`), `otp.resend` — including the clinic-wide ceilings and `SMS_KILL_SWITCH` (A6) |
| `NOT_FOUND` | `booking.getByReference`, `otp.resend`/`.verify`, `appointments.get`/`.updateStatus`/`.reschedule`/`.setNote`, `patients.get` (envelope); the success page's loader and `.ics` route (as real `404`s, A5, same uniform view) |
| `UNAUTHORIZED` | every `auth: "admin"` action with no session; `adminAuth.login` on bad credentials; cron route (as real `401`) |
| `FORBIDDEN` | every `auth: "admin"` action whose session's account is inactive, or (unused seam, C4) has an insufficient role; `adminAuth.login` on a deactivated account |
| `ACCOUNT_LOCKED` | every `auth: "admin"` action whose session's account has `lockedUntil` in the future; `adminAuth.login` on a locked account (A4) |
| `INVALID_TRANSITION` | `appointments.updateStatus`, `appointments.reschedule` |
| `CLOSED_DAY` | `booking.create`, `appointments.createByAdmin` (see 5.2's assumption) |
| `OUTSIDE_BOOKING_WINDOW` | `booking.create`, `appointments.createByAdmin` |
| `INTERNAL` | any action, on an unmapped exception |

#### CSRF

Server Actions need no CSRF token of their own: the Next.js runtime checks the request's `Origin` header against the deployment's own host before the function body runs at all — a cross-origin `POST` is rejected by the transport, before Zod parsing, before `defineAction`'s pipeline starts (C13). Auth.js adds a second, independent layer for the one flow that predates a session: `/api/auth/[...nextauth]`'s credentials callback issues and checks its own double-submit CSRF token, because that Route Handler sits outside the Server Action transport and gets no automatic origin check. The cron route can use neither: there is no browser, no cookie, and no same-origin request to check — Vercel Cron calls it directly over HTTPS — so a static bearer secret (`CRON_SECRET`) is the only applicable guard, and it is immune to CSRF for the same reason it needs its own guard at all: CSRF exploits a browser automatically attaching session state to a request the user didn't intend, and no browser is involved in this call.

#### Contract Challenges

- **C14 vs C13's identifier convention**: C14 pins a rate-limit rule literally named `otp.send`, implying an addressable operation, but Section 3's folder plan correctly keeps OTP sending non-exported (there is no independent client trigger for "send an OTP" apart from creating or resending a booking's challenge — see 5.3.1). C13 states every rate-limited surface should carry a stable `action <feature>.<name>` identifier; this section resolves the tension by documenting `otp.send` as **Kind: Internal** with the identifier used only for the rate-limit rule and log correlation, never for a `"use server"` export. The contract should either rename the C14 rule to make clear it limits an internal operation shared by two callers, or state explicitly that rule names need not be 1:1 with exported action identifiers.
- **C4's `AuditAction` union still has no value for reordering services or for a working-hours-specific edit distinct from general settings** (A1 closed the adjacent reactivation gap by adding `SERVICE_REACTIVATED`, which `services.setActive` now writes — 5.8). This section resolves the remaining two by writing no audit row for `services.reorder` and by reusing `SETTINGS_UPDATED` for `settings.updateWorkingHours` — defensible, but a complete audit trail arguably wants a dedicated value for each; C4 should either add them or state outright that these two particular mutations are intentionally un-audited.
