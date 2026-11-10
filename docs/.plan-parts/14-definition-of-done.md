## 14. Definition of Done

Every item is a checkbox with a named, independently reproducible verification method — a second engineer, the clinic owner, or a CI job, never the implementer's own say-so. Items point at the test IDs and sections that already define pass/fail (4, 6, 9, 10, 11) rather than restating them.

### 14.1 Functional completeness

#### 14.1.1 Landing page (`/`)
- [ ] All eight brief sections present (Hero+CTA, Services+prices, About, How-It-Works, Testimonials, Hours/Location, FAQ, Footer): screenshot pass against Section 8.1's wireframes.
- [ ] `/` is SSG, zero runtime fetch: `next build` marks `/` static; a network-tab recording shows no XHR/fetch.
- [ ] Rendered service names/durations/prices match the seeded `Service` rows (4.6): diff against the seed table.
- [ ] No horizontal scroll/overlap at 375/768/1440px: Playwright viewport sweep.
- [ ] WCAG 2.1 AA and Lighthouse ≥95 — see 14.4/14.5.

#### 14.1.2 Booking flow (`/book`)
- [ ] Steps 1-5 behave per spec: service required before Next; date step disables past/closed/full days (E8); slots cover all 16 Section 6.6 edge cases (`availability.test.ts`); name/phone pass schema validation; review step gates submit on the confirm checkbox.
- [ ] OTP lifecycle correct: pluggable `SmsProvider`, 5-min expiry, 5-attempt cap, 60s cooldown, 3-resend cap: `otp.test.ts` + E6.
- [ ] Success screen shows the `MB-XXXXXX` reference, a valid `.ics`, and a captured confirmation SMS: E1.
- [ ] A losing concurrent booking gets a graceful `SLOT_TAKEN` recovery, never a crash: E2, plus 14.3 below.
- [ ] UTC storage / clinic-local display correct through both 2026 DST transitions: FixedClock cases, 11.3.1.

#### 14.1.3 Admin area (`/admin/*`)
- [ ] Hashed-password, session-cookie login, rate-limited; every `/admin/*` route redirects when logged out: E3.
- [ ] KPI cards match Section 9.11's exact seed numbers; both charts render the same datasets and respond to the shared date-range filter: E4.
- [ ] Calendar shows day/week/month views, color-coded by status: manual QA screenshots of all three views, plus E7's reschedule check.
- [ ] Appointments table search/filter/pagination and all five actions (confirm/complete/no-show/cancel/reschedule): E7 + component tests (11.4).
- [ ] Patients list (name, phone, visits, spend, last visit) reconciles against 9.11's distinct-phone count: integration test.
- [ ] Settings (hours incl. split shifts, closed dates, slot interval, services CRUD) take effect on the next patient-side read: E8.
- [ ] Currency as configurable integer minor units via `Intl`'s own exponent, never a hardcoded `/100`: `money.test.ts`.

### 14.2 Quality gates
- [ ] `tsc --noEmit` zero errors under `strict` + `noUncheckedIndexedAccess` (C2) — CI `typecheck` green.
- [ ] `eslint --max-warnings=0` clean, including the `no-restricted-syntax`/`no-restricted-paths` rules (2.2/3) — CI `lint` green.
- [ ] Zero `any` in `src/`, enforced by `@typescript-eslint/no-explicit-any: "error"` (assumption: not pinned elsewhere) — same job, plus a `grep ": any"` over `src/` returning nothing.
- [ ] `prettier --check` clean — CI `format` green.
- [ ] Every Section 11.1 per-layer coverage bar met, plus the repo-wide 85% statement floor — Vitest `v8` thresholds in `vitest.config.ts` fail the job otherwise.
- [ ] All nine required status checks (typecheck, lint, format, unit, component, build, integration, e2e, lighthouse — 11.8) green on `main`'s latest commit.

### 14.3 Test evidence
- [ ] All nine E2E scenarios (E1-E9, 11.6) pass on a freshly seeded build — zero failed/flaky specs in the Playwright report.
- [ ] **Double-booking (E2) is not accepted alone** — it proves graceful UX at the browser level, not the DB guarantee (11.6's own caveat). Required too: 11.5's concurrent-`createBooking` test logs a genuine `P2002` on `AppointmentSlot.slotStartUtc` mapped to `SLOT_TAKEN`, not just "one won"; and E2 survives ≥20 repeated runs with zero flakes.
- [ ] **KPI accuracy (E4) is not accepted on matching numbers alone** — a wrong query can cancel out on this one seed. Required too: each KPI query reviewed against its Section 9 definition, filter clause named in the review; and a boundary-mutation check — shift one seeded `startsAtUtc` by ±1 minute across a bucket edge, confirm the KPI moves by exactly that row's amount.
- [ ] **`ACCOUNT_LOCKED` and `FORBIDDEN` are not accepted as a shared code path** — a login attempt against a temporarily locked (`lockedUntil` in the future) but active account must assert `error.code === 'ACCOUNT_LOCKED'`, and a login attempt against an inactive (`isActive = false`) or insufficient-role account must assert `error.code === 'FORBIDDEN'`, both asserted by code in the same test file, not distinguished only by message text: `auth.test.ts` + E3.
- [ ] Every `ErrorCode` in C12 has a triggering test somewhere in the suite; no Server Action throws uncaught in any suite.

### 14.4 Performance
- [ ] Lighthouse ≥95 — the median of `numberOfRuns: 3`, never a single run (A10) — in Performance, Accessibility, Best Practices, and SEO on `/`, on `lighthouserc.json`'s default throttled-mobile run: CI `lighthouse` artifact (11.7).
- [ ] Zero third-party scripts, ≤90KB gzipped JS on `/`: Lighthouse CI's budget assertion plus `next build`'s printed First Load JS.
- [ ] Booking-path p95 observed under a scripted load test against a deployed Preview on production's pooled-Postgres topology (2.6): `getSlots` <120ms, `booking.create` <250ms, `otp.verify` <150ms, dashboard aggregate <400ms (C23): the load tool's own percentile report.

### 14.5 Accessibility
- [ ] WCAG 2.1 AA; axe zero `serious`/`critical` violations on every route in Section 3, mobile and desktop: E9.
- [ ] Full booking flow completable keyboard-only, no mouse: E9.
- [ ] Contrast audit (Section 8.3.4) committed, every pair in use PASS at 4.5:1 normal / 3:1 large-or-non-text (C18): diff against 8.3's token list.
- [ ] Every canonical CSS variable required by Section 8.3.2's token set (`background` through `radius`, including `primary-button`, `primary-button-hover`, and `chart-1`-`chart-5`) resolves to a non-empty computed value in BOTH the light and the `.dark` theme — closing the missing `--chart-1` defect found in review: a Playwright check that reads `getComputedStyle` for every token name in both themes and fails on any empty string.
- [ ] Visible focus indicator on every interactive element, never suppressed: E9 plus code review confirming no rule removes `:focus-visible`.
- [ ] `prefers-reduced-motion: reduce` zeroes the booking wizard's transition durations: Playwright `emulateMedia` test.

### 14.6 Security and privacy
- [ ] Every control row across Section 10.1-10.10 shows `Status: Done`, each confirmed by that row's own named method: a pass through the 10.x tables, no "Planned" left.
- [ ] `.env.example` matches C16's variable list exactly, no values; no secret ever committed: diff against C16 plus `git log --all -p -- .env*` (CFG-1/2).
- [ ] All six security headers present in production: `curl -I` against the live domain (HDR-1..6).
- [ ] A log sample reviewed line-by-line against C19/LOG-2's banned-field list: reviewer sign-off naming sample window and row count.
- [ ] `scripts/retention.ts` run against a seeded non-prod branch, output matches Section 4.7/10.9 exactly: before/after row diff.
- [ ] Rate limits demonstrated live, not just unit-asserted: the 61st read in a minute, the 6th login failure, the 4th resend, the 201st OTP send inside a rolling 24h window (`otp.send.global`'s 200 ceiling), and a breach of `SMS_DAILY_CAP_MINOR` (`sms.spend.global`) each trip their code against a running deployment, and setting `SMS_KILL_SWITCH=true` is proven to short-circuit all sending immediately: `ratelimit.test.ts` + E3/E6.
- [ ] `POST /api/test/reset` is absent from a production build: a security-suite test builds with `NODE_ENV=production` and without `E2E_TEST_HOOKS=true` set, then asserts the route 404s.

### 14.7 Data and operations
- [ ] `prisma migrate deploy` applies cleanly from an empty Postgres schema: proven by every CI `integration`/`e2e` run doing exactly this (11.8).
- [ ] `pnpm prisma db seed` run twice is byte-identical: checksum diff across two consecutive runs (4.6).
- [ ] Both crons registered and firing once post-deploy: Vercel Cron `*/5 * * * *` → `expire-holds`; GitHub Actions retention workflow: a real invocation in the function log, and a green scheduled (not manual) Actions run (2.6).
- [ ] Backups/restore tested, closing R-DR (13.1): PITR enabled (provider dashboard) and a restore drill performed on a non-prod branch: one known row's value compared before and after.
- [ ] Monitoring/alerting live: an uptime monitor on `GET /api/health` with ≥1 recorded success; the SMS spend kill switch (RATE-9) fire-tested in staging: monitor dashboard, alert transport receipt.

### 14.8 Documentation and handover
- [ ] README quickstart: clone to a running `pnpm dev` session rendering `/` in under 15 minutes: timed dry run by someone who didn't write the code.
- [ ] `docs/PLAN.md` amended to match what was actually built: PR review against the Contract Challenges collected across Sections 1-13.
- [ ] Admin runbook covers daily workflow plus named failure modes (locked-out login, AUTHN-7; OTP-stuck patient, R-OTPLOCK; undelivered SMS, R-SMSSTATUS): clinic-staff dry run, unassisted.
- [ ] Rollback procedure documented and rehearsed (`vercel rollback` plus a migration-compatibility check): a staging rehearsal.
- [ ] Every open question OQ1-OQ15 (Section 1.4) carries a stakeholder-confirmed answer or an explicit "shipping on default" note, zero blanks: line-by-line review.

### 14.9 Sign-off
- [ ] Clinic owner signs functional acceptance (14.1 complete) after a live walkthrough of one full booking and one full admin session: dated signature.
- [ ] Engineer signs quality gates (14.2-14.7 complete): dated signature or signed checklist attached to the release commit.
- [ ] Go-live checklist, each line initialed immediately before launch: domain live (closes OQ13); every C16 var set in Production; seed never run against prod (R-SEEDPROD); A2P carrier registration (10DLC/toll-free verification, initiated in Phase 1 per A11) confirmed APPROVED before switch-over; `SMS_PROVIDER=twilio` with live credentials; seeded admin password changed from its default; Lighthouse and E2E green on the exact deployed commit; PITR enabled; uptime monitor live.
