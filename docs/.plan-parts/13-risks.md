## 13. Risks and Mitigations

This register is deliberately candid: several rows describe things the plan accepts rather than
solves, because solving them is out of scope (C1) or not worth the complexity at single-clinic
scale. "Mitigation" cites what Sections 2-11 already build; "Contingency" is the fallback when the
mitigation isn't enough.

### 13.1 Risk register

| ID | Risk | Category | Likelihood | Impact | Mitigation | Early warning signal | Contingency |
|---|---|---|---|---|---|---|---|
| R-SSG | `/` (SSG) drifts from live `Service` prices after an admin edit | Freshness | Medium | Medium | Build-time read + `revalidatePath('/')` on save (2.3) | "Site still shows old price" | Manual rebuild/redeploy; or short-window ISR (2.3) |
| R-TZ | Wrong-time booking from a local-time bug instead of `fromZonedTime` | Correctness | High | High | `new Date()` ESLint ban (C22); DST tie-break (C6, 6.3); FixedClock DST tests (6.6) | Time complaint on a DST changeover date | Hotfix call site; correct affected rows; phone the patient |
| R-RL | `RATE_LIMIT_PROVIDER=memory` in prod; counters are per-instance | Security | Medium | Medium | DB-backed `OtpChallenge.attempts`/`AdminUser.lockedUntil` back up any limiter choice (C14) | Twilio spend outpacing unique phones/IPs | Flip env var to `upstash`, no redeploy |
| R-SMS | OTP pumping/toll fraud; Twilio deliverability, sender-ID rules, carrier-registration lead times | Financial | Medium | High | Per-phone/IP limits (C14); clinic-wide `otp.send.global` 200/24h + `SMS_DAILY_CAP_MINOR` spend ceiling (A6); 3-resend cap (C10); carrier registration scheduled as a long-lead Phase 1 task (A11); pluggable `SmsProvider` | Spend spike with no matching `CONFIRMED` growth, or the global-ceiling breach logging a `CRITICAL` event | `SMS_KILL_SWITCH=true` halts all sending immediately (A6); held bookings still land as `PENDING_VERIFICATION` for manual confirmation; add destination allow-list |
| R-DBL | Double booking regresses once only the non-atomic UI race test survives in CI | Correctness | Low | High | `slotStartUtc` unique index (C5); 11.5's in-process `Promise.all` is the real proof, not E2 | `11.5` skipped/quarantined in CI | Treat any 11.5 skip as a release blocker |
| R-CONN | Connection exhaustion: unpooled endpoint used, or pooler undersized | Availability | Medium | High | Pooled `DATABASE_URL`; `DIRECT_DATABASE_URL` for migrations only (C23); cached singleton client | `P1017` errors at peak hours | Resize pooler max connections; add a pre-launch load test |
| R-COLD | Cold-start latency hurts perceived speed, though it's outside the measured budget | Performance | Medium | Low | Budget scoped to handler duration only, excludes SMS I/O and cold start, and says so (C23) | "Feels slow" despite logs showing compliance | Minimum-instance warm-up; document the gap |
| R-RESOURCE | Single bookable resource is wrong if the clinic runs two rooms in parallel | Scope | Low | High | `practitionerId`/`resourceId` exist as unimplemented, documented seams (C1) | Stakeholder mentions a second room in UAT | Scope as a new feature (13.2.6), not a flag |
| R-SELFCANCEL | No patient self-cancel (C1: no portal); drives phone load and no-shows | Operational | High | Medium | Staff cancels via `appointments.updateStatus` (cancel transition, Section 5.1); reference+phone finds a booking on a call | Rising cancel-by-phone volume | Add a reference-token self-cancel route (C8) in v1.1 |
| R-REMIND | No automated reminder SMS; brief doesn't request one | Revenue | High | Medium | Confirmation SMS only, at booking time (C9.4); `SmsProvider` is reminder-ready | `NO_SHOW` rate above `CANCELLED` in KPIs (9) | Add a scheduled reminder job post-v1 |
| R-ADMINRESET | No admin password reset; one seeded admin, no recovery path | Operational | Low | Medium | `AdminUser` supports more rows; a second admin can be seeded | Admin locked out; repeated `ADMIN_LOGIN_FAILED` | Direct DB password update by a trusted operator |
| R-JWT | JWT session valid for its full 8h; no server-side revocation list | Security | Low | Medium | `HttpOnly`/`Secure` cookie (C11); `requireAdmin()` re-checks live `isActive`/`lockedUntil` every call | Lost/stolen admin device reported | Set `AdminUser.isActive = false` — next call rejected even with a valid cookie |
| R-OTPLOCK | Poor reception causes repeated OTP failures; attempts/expiry locks the patient out | Accessibility | Medium | Medium | Resend with cooldown, 3 per challenge (C10); clinic phone on every public page | `OTP_MAX_ATTEMPTS`/`OTP_EXPIRED` spikes by region | Staff books by phone with `source: "ADMIN"` (C4) |
| R-GDPR | Phone + name, joined to a `Service.name` that can imply a health condition | Privacy | Medium | High | Minimal fields; 24mo retention (C20); PII-redacting logger (C19); operational DSAR (10) | A patient/regulator data request | Run `scripts/retention.ts --patient-id` for that patient |
| R-LIGHTHOUSE | A later PR adds a third-party script or heavy image, breaking the >=95 floor | Performance | Medium | Medium | Lighthouse CI gate on every PR, `numberOfRuns: 3` + median-score gate to resist run-to-run jitter (A10, C23); 0-script and image budgets stated up front | CI fails the Lighthouse median on an unrelated PR | Revert/defer, or re-budget the allowance explicitly |
| R-TOKENDRIFT | Two parts of the spec invent different names for the same design token, so a later-phase task can't resolve the CSS variable it depends on | Spec consistency | Low | Medium | Single canonical token section is the only place names are declared (C18, Section 8.3.2, A8); a Phase 2 acceptance criterion asserts every canonical variable resolves (e.g. `getComputedStyle` returns a non-empty value for `--chart-1`) before Phase 8 work starts | A Phase 8+ chart task fails because `hsl(var(--chart-1))` resolves to nothing | Add the missing token to Section 8.3.2 and re-run the Phase 2 acceptance check; block the dependent phase from starting until it's green |
| R-SCOPE | Pressure to add multi-doctor, payments, or a patient portal mid-build | Organizational | High | Medium | C1 states exclusions and two concrete seams up front | A "small addition" touching resource model/payments | Log as a scoped v2 proposal; don't fold into this build |
| R-KEYPERSON | Bespoke single-clinic app, one implementer, no handover runbook | Organizational | Medium | High | This plan, the `Clock` seam (C22), and the DST test table (6.6) are the handover artifact | Implementer unavailable when a bug needs a response | Keep PLAN.md, `.env.example`, README current as the handover minimum |
| R-SEEDPROD | `seed.ts` sample data runs against prod, polluting KPI numbers | Data integrity | Low | Medium | `db:seed` is a separate command, never part of `build`/`migrate deploy` | A suspiciously round, seed-like KPI number | Delete seeded rows by a known marker; guard the script on `NODE_ENV` |
| R-SMSSTATUS | Fire-and-forget SMS send (C9.3) hides a real Twilio delivery failure | Reliability | Medium | Low | OTP failure still surfaces at verify; confirmation failure never un-confirms the booking | Delivery mismatch with no in-app signal | Treat `.ics` + on-screen reference as the real confirmation |
| R-DR | No stated backup/restore runbook or RPO/RTO for production Postgres | Availability | Low | High | Managed-Postgres PITR by default; migrations tracked and reproducible (3) | A data-loss incident with no documented recovery step | Treat provider PITR docs as the runbook; add a restore drill before launch |

### 13.2 Top six, expanded

#### 13.2.1 Time zone and DST defects (R-TZ)

Most likely because it's silent: a `Date` built from local wall-clock parts instead of
`fromZonedTime` is wrong by exactly the clinic's UTC offset, with no error. Today: C6 bans local-time
construction, 6.3's `resolveWallTime` picks the earlier instant on an ambiguous fall-back wall time
and drops candidates on a nonexistent spring-forward one, and FixedClock tests pin both cases (6.6).
Accepted gap: the C22 ESLint ban scopes to `src/server/**` and action files, not client components —
a slot label in `time-step.tsx` or FullCalendar's own date handling in `admin-calendar.tsx` can still
trust the browser's local zone instead of `formatInTimeZone`, and nothing lints that. The storage-side
guarantee is solid; the display-side one depends on review discipline that isn't automated yet.

#### 13.2.2 Double-booking escaping to production via test erosion (R-DBL)

The real guarantee is the `slotStartUtc` unique index (C5); 11.5's forced in-process `Promise.all`
on `createBooking` is the only test that actually proves it. `E2`'s Playwright race, by its own
stated caveat, demonstrates graceful UI handling of a near-simultaneous click, not the DB guarantee —
two browser clicks dispatched together land close but not atomically. The risk is organizational:
real-database integration tests are slower and more fragile in CI, which is exactly the profile that
gets `.skip`'d under deadline pressure. If 11.5 goes dark, the suite stays green while a regression in
the unique-index path (a weakened migration, a refactor moving slot inserts out of the transaction)
goes undetected. Nothing in CI config currently makes skipping 11.5 harder than skipping any other
test; making it a non-skippable release gate is a cheap fix not yet written down anywhere.

#### 13.2.3 Per-instance rate limiting on serverless (R-RL)

`MemoryRateLimiter`'s sliding window lives in one instance's memory; Vercel runs many instances
concurrently, each with its own empty map, so a `memory`-configured deployment's real throughput is
closer to (limit) x (instance count) than to the limit — C14 says so outright. Today's backstop:
`OtpChallenge.attempts`/`AdminUser.lockedUntil` are read from Postgres, shared by every instance, so
OTP and login brute force stay bounded at a coarser, per-row granularity even if the limiter is
misconfigured. Accepted gap: that backstop only bites once a specific phone has already been
targeted — OTP pumping against a fresh phone number each time (R-SMS) isn't capped by any DB row,
because a new number means a new, uncounted `OtpChallenge`. There's also no startup check that fails
loudly if `RATE_LIMIT_PROVIDER=memory` reaches a production env; it ships quietly wrong today.

#### 13.2.4 SMS toll fraud, OTP pumping, and Twilio deliverability/regulatory risk (R-SMS)

Every `otp.send` costs money whether or not the booking completes, the one risk with direct financial
exposure if left uncapped. C14's per-phone/IP limits bound cost per key, but a distributed attacker
rotating through many phone numbers and IPs used to defeat that bound entirely — each new number
arrived with a clean counter. A6 closes this: `otp.send.global` (200 sends per rolling 24h,
clinic-wide, independent of key) and `sms.spend.global` (`SMS_DAILY_CAP_MINOR`, a daily spend ceiling
in minor units) cap exposure regardless of how many distinct phones or IPs an attacker burns, and
`SMS_KILL_SWITCH=true` short-circuits all sending immediately for use mid-attack. Honest residual
risk: both ceilings are clinic-wide and blunt — a breach stops sending for every patient, not just the
attacker, until the 24h window rolls over or an operator intervenes; bookings still succeed as
`PENDING_VERIFICATION` so a held slot isn't lost, but confirmation becomes a manual, staff-driven step
until sending resumes. There is still no destination allow-list, so a sustained attacker can hold the
global ceiling pinned at its cap rather than being singled out. Separately, plain deliverability is a
launch risk: alphanumeric sender IDs aren't supported in every country (notably US/Canada), so
`CLINIC_DEFAULT_COUNTRY` may require Messaging Service, toll-free, or 10DLC registration — carrier
review that takes days to weeks and that no engineering effort can compress. A11 schedules this as a
long-lead, non-blocking task in Phase 1 (initiate the Twilio account and A2P registration, record the
expected approval date), with Phase 12's provider switch-over declaring a dependency on it; the
console `SmsProvider` covers all development and testing while approval is pending. Today's mitigation:
the pluggable `SmsProvider` isolates Twilio behind one seam, so swapping configuration or provider
never touches application code.

#### 13.2.5 Prisma connection exhaustion on serverless (R-CONN)

Without a pooled endpoint, each invocation opening its own connection hits `max_connections` under
moderate concurrency — and invocations spike exactly when the clinic is busiest, so the failure lands
as a hard outage at the worst time. Today's mitigation (C23): `DATABASE_URL` is pooled with
`connection_limit=1`; `DIRECT_DATABASE_URL` is unpooled and used only by `prisma migrate deploy` from
CI; the `PrismaClient` singleton is cached on `globalThis` so one warm instance doesn't multiply its
own connections. Accepted gap: `connection_limit=1` per instance means the real ceiling is the
pooler's own configured max versus how many instances Vercel actually spins up under load — that
sizing conversation isn't resolved anywhere in the plan, and Section 11 has no load/soak test that
would surface it before real traffic does. This belongs on a go-live checklist as a number, not an
assumed default.

#### 13.2.6 Single bookable resource as a model risk (R-RESOURCE)

C1 pins one bookable resource, and every slot-engine query (Section 6) is built on that being true.
If the clinic actually runs two rooms or a second practitioner in parallel, the system understates
real capacity: `getAvailableDays` marks a day `FULLY_BOOKED` while a second room sits open, costing
real booking volume. Today: `practitionerId` and a hardcoded `resourceId` exist as documented, unused
seams (C1) — a known deferral, not a surprise. What it would cost to fix: `AppointmentSlot`'s unique
index is on `slotStartUtc` alone (C5), global across the clinic, not per resource. Supporting N
resources means changing that to `@@unique([resourceId, slotStartUtc])` — the core concurrency
guarantee (6.4) — cascading into every slot-engine query, the availability cache keys, the admin
calendar's color-coding, and a backfill migration assigning history to a resource. That is a scoped
feature, estimated like one, not a flag flip because a field name already exists. If the assumption
is wrong, it belongs on Section 1's stakeholder sign-off list before build, not discovered in UAT.
