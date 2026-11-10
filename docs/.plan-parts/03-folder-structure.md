## 3. Folder / File Structure

Full repository tree. Generated/vendor directories (`node_modules/`, `.next/`, `.turbo/`, coverage output, Playwright report output) are omitted — standard, not project-specific. Every directory ends in `/`; every other line is a real file. A trailing `//` comment explains purpose where the filename alone doesn't. For each of the 9 features (C17) every conventional slot — `components/`, `actions.ts`, `schemas.ts`, `queries.ts`, `types.ts`, `hooks/` — is either a real file or an explicit `(… omitted — reason)` line, never silently dropped.

```text
med-reserv/
  README.md                          // setup: docker compose up -d db, pnpm install, pnpm db:migrate, pnpm db:seed, pnpm dev
  package.json                       // scripts: dev, build, start, lint, test, test:e2e, db:migrate, db:sqlite, db:seed
  tsconfig.json                      // strict + noUncheckedIndexedAccess (C2); path alias "@/*" -> "src/*"
  next.config.mjs                    // Server Actions config, security headers; no image remote patterns needed (no external images)
  tailwind.config.ts                 // v3.4.x, NOT v4 CSS-first (C2); HSL CSS-var token mapping (C18)
  postcss.config.mjs                 // tailwindcss + autoprefixer plugins
  eslint.config.mjs                  // flat config; no-restricted-syntax bans new Date() outside lib/clock.ts (C22) and
                                      // raw process.env outside lib/env.ts (C16); no-restricted-imports bans argon2/Prisma in middleware (C11)
  .prettierrc.json                   // formatting rules (tailwind class-sorting plugin enabled)
  .prettierignore
  vitest.config.ts                   // two environments via projects: node (unit, tests/unit/**) and jsdom (component, tests/component/**)
  playwright.config.ts               // baseURL, webServer boot, projects: chromium/webkit; tests/e2e/**
  lighthouserc.json                  // asserts >=95 all 4 categories against the built "/" route (C23)
  docker-compose.yml                 // Postgres 16 "db" service for local dev (C3); no redis — dev uses MemoryRateLimiter
  .env.example                       // exact var list in C16; no values, comments only
  components.json                    // shadcn CLI config: aliases "@/components", "@/lib", "@/ui"; css app/globals.css
  .gitignore                         // node_modules, .next, .env*, prisma/schema.sqlite.prisma (generated, see 3.1)

  src/
    middleware.ts                    // matcher protects /admin/:path* except /admin/login (C11). Lives under src/, not repo
                                      // root, because app/ is under src/ — Next.js requires middleware.ts at the same level
                                      // as app/ when a src/ directory is used (see 3.1 assumption)
    auth.config.ts                   // Edge-safe: providers: [], callbacks only. Imported by middleware.ts (C11)
    auth.ts                          // full Auth.js v5 config: Credentials provider + @node-rs/argon2. Node runtime only (C11)

    app/
      layout.tsx                     // root <html>; next/font Inter + Plus Jakarta Sans (C18); imports globals.css
      globals.css                    // Tailwind directives + :root / .dark HSL CSS variables for every C18 token
      page.tsx                       // "/" — SSG, revalidate: false (C15); build-time Prisma read of active Services
      loading.tsx                    // root suspense fallback (skeleton)
      error.tsx                      // root error boundary
      not-found.tsx                  // global 404
      opengraph-image.tsx            // generated OG image for "/", inherited by routes without their own override
      sitemap.ts                     // MetadataRoute.Sitemap: "/", "/privacy", "/terms", "/book" (admin + success excluded, noindex)
      robots.ts                      // MetadataRoute.Robots: disallow /admin, /book/success, /api
      privacy/
        page.tsx                     // SSG; states the C20 retention policy in prose
      terms/
        page.tsx                     // SSG
      book/
        page.tsx                     // "/book" — static shell, dynamic = 'force-static' (C15); mounts <BookingWizard/> client island
        loading.tsx
        error.tsx                    // catches unexpected render errors; action failures never throw (C12), handled in-wizard
        success/
          [reference]/
            page.tsx                 // "/book/success/[reference]" — dynamic SSR, no-store, noindex (C15); capability token (C8)
            not-found.tsx            // unknown/foreign reference -> NOT_FOUND (C12)
      admin/
        layout.tsx                   // outer shell: force-dynamic + noindex metadata for all /admin/* (C15); no visual chrome
                                      // (kept separate from the inner layout below so /admin/login renders without the sidebar)
        login/
          page.tsx                   // "/admin/login" — dynamic SSR (C15)
          loading.tsx
        (dashboard)/                 // route group: adds the authenticated shell, contributes no URL segment
          layout.tsx                 // sidebar + topbar chrome; reads session via auth() for display name only
                                      // (middleware + requireAdmin() in every action are the actual gate, C11 — this layout
                                      // is not a security boundary)
          error.tsx
          page.tsx                   // "/admin" — dynamic SSR, searchParams-driven date range (C15)
          loading.tsx
          _components/               // route-private: colocated chrome, not reused outside /admin (see 3.1)
            admin-sidebar.tsx
            admin-topbar.tsx         // user menu (sign out), ThemeToggle slot
            admin-nav-items.ts       // { href, label, icon }[] — Section 12 tasks that add an admin page touch this file
          calendar/
            page.tsx                 // "/admin/calendar" — dynamic SSR shell + FullCalendar client island (C15)
            loading.tsx
          appointments/
            page.tsx                 // "/admin/appointments" — searchParams: page, q, status, service, range (C15)
            loading.tsx
          patients/
            page.tsx                 // "/admin/patients" — searchParams-driven (C15)
            loading.tsx
          settings/
            page.tsx                 // "/admin/settings" — dynamic SSR + client forms (C15)
            loading.tsx
      api/
        auth/
          "[...nextauth]"/
            route.ts                 // GET/POST — Auth.js handler (C13)
        appointments/
          "[reference]"/
            ics/
              route.ts                // GET /api/appointments/[reference]/ics — Content-Disposition file download (C13);
                                      // shares the reference.lookup rate-limit rule (C14) with the success-page SSR query
        cron/
          expire-holds/
            route.ts                 // POST, Bearer CRON_SECRET, every 5 min (C13); same sweep as the lazy path in C9.5
        health/
          route.ts                   // GET — uptime probe, no schema detail leaked (C13)
        test/
          reset/
            route.ts                 // POST — RateLimiter.resetAll() + clears AdminUser.failedLoginCount/lockedUntil (C24 A6b);
                                      // registered ONLY when NODE_ENV !== "production" AND E2E_TEST_HOOKS === "true"; called by
                                      // Playwright global setup and between limit-exercising specs; a security-suite test
                                      // asserts this route is absent from a production build

    features/
      landing/
        components/
          hero-section.tsx
          services-section.tsx       // prices via lib/money.ts formatMoney
          about-section.tsx          // doctors, from content/site.ts
          how-it-works-section.tsx   // 3 steps
          testimonials-section.tsx
          hours-location-section.tsx
          faq-section.tsx
        queries.ts                   // getActiveServicesForLanding() — the one build-time Prisma read (C15)
        types.ts                     // LandingContent, ServiceCardView
        (actions.ts omitted — the public landing page has no mutations)
        (schemas.ts omitted — no form input to validate)
        (hooks/ omitted — pure SSG, no client state)

      booking/
        components/
          booking-wizard.tsx         // "use client" step-sequencing island mounted by app/book/page.tsx
          service-step.tsx
          date-step.tsx              // react-day-picker; disables past/closed/full days
          time-step.tsx              // slot grid for the selected date
          details-step.tsx           // full name + phone; renders <PhoneInput>
          phone-input.tsx            // ui/command + ui/popover country selector, feeds libphonenumber-js (lib/phone.ts)
          review-step.tsx            // summary + the required explicit confirm checkbox
          slot-picker.tsx            // shared by date-step (day fullness) and time-step (slot buttons)
        hooks/
          use-booking-wizard.ts      // client step state machine (current step, draft, back/next guards)
        actions.ts                   // action booking.createBooking (C9.2-3)
        schemas.ts                   // per-step Zod schemas + createBookingInputSchema; imported by both the step forms and actions.ts
        queries.ts                   // getBookableServices(), getAvailableSlots(date, serviceId), getAvailableDays(yearMonth,
                                      // serviceId) -> delegates to server/slots/availability.ts
        types.ts                     // BookingWizardState, StepId union, BookingDraft

      otp/
        components/
          otp-input.tsx              // 6-digit input
          otp-resend-button.tsx      // owns the 60s cooldown countdown display
        actions.ts                   // action otp.verifyOtp, action otp.resendOtp (otp.send is internal to booking.createBooking, C9.3)
        schemas.ts                   // otpCodeSchema (6 digits)
        types.ts                     // OtpChallengeView
        (queries.ts omitted — challenge state is only ever read back through an action result, never fetched standalone)
        (hooks/ omitted — cooldown timer lives inside otp-resend-button.tsx)

      admin-auth/
        components/
          login-form.tsx
        actions.ts                   // action adminAuth.login — thin wrapper around Auth.js signIn("credentials", ...);
                                      // the actual password check is authorize() inside src/auth.ts (C11), not here
        schemas.ts                   // loginSchema (email, password)
        types.ts                     // LoginFormValues
        (queries.ts omitted — no reads outside the Credentials authorize() callback)
        (hooks/ omitted)

      dashboard/
        components/
          kpi-grid.tsx
          kpi-card.tsx
          revenue-chart.tsx          // Recharts; daily/weekly/monthly toggle via ui/tabs
          appointments-by-service-chart.tsx
          date-range-filter.tsx      // dashboard-specific wrapper (searchParams wiring) around shared components/date-range-picker.tsx
        queries.ts                   // getDashboardKpis(range), getRevenueSeries(range, granularity), getAppointmentsByService(range) — Section 9
        schemas.ts                   // dashboardRangeSchema (parses the range/granularity searchParams)
        types.ts                     // KpiSnapshot, RevenuePoint, ServiceBreakdownPoint
        (actions.ts omitted — read-only feature, no mutations)
        (hooks/ omitted)

      appointments/
        components/
          appointments-table.tsx     // ui/table + shared data-table-pagination.tsx
          appointments-filters.tsx   // search, status, service, date range (composes shared date-range-picker.tsx)
          appointment-row-actions.tsx // ui/dropdown-menu: confirm/complete/no-show/cancel/reschedule
          reschedule-dialog.tsx      // ui/dialog; picks a new slot via booking/slot-picker.tsx
          admin-calendar.tsx         // "use client" FullCalendar wrapper; color-codes by status via shared status-badge.tsx palette
          calendar-view-toggle.tsx   // ui/tabs driving calendarRef.current.changeView() (day/week/month) — kept custom so the
                                      // control matches C18 styling instead of FullCalendar's default toolbar buttons
        actions.ts                   // action appointments.updateStatus (confirm/complete/markNoShow/cancel collapsed
                                      // per Section 5.1 Naming Reconciliation), appointments.reschedule — both route
                                      // through server/appointments/transitions.ts (C4)
        schemas.ts                   // appointmentsFiltersSchema, rescheduleSchema
        queries.ts                   // listAppointments(filters), getAppointmentById(id)
        types.ts                     // AppointmentRow, AppointmentsFilters
        (hooks/ omitted)

      patients/
        components/
          patients-table.tsx         // name, phone, visit count, total spent, last visit
        queries.ts                   // listPatients(filters) — aggregates Appointment by patientId
        schemas.ts                   // patientsFiltersSchema
        types.ts                     // PatientRow
        (actions.ts omitted — patients are read-only in v1; no patient-record mutation exists, C1)
        (hooks/ omitted)

      services/
        components/
          services-table.tsx
          service-form-dialog.tsx    // create/edit; ui/dialog + ui/form
        actions.ts                   // action services.create, .update, .deactivate (soft delete via isActive, never hard-delete)
        schemas.ts                   // serviceInputSchema (name, durationMin, priceMinor, colorHex, sortOrder)
        queries.ts                   // listServices(), getServiceById(id)
        types.ts                     // ServiceRow

      settings/
        components/
          working-hours-form.tsx     // per-weekday open/close minutes; supports split shifts (multiple rows per weekday)
          closed-dates-form.tsx      // add/remove ClosedDate rows
          general-settings-form.tsx  // clinicName, timeZone, currency, slotIntervalMin, bufferMin, minLeadTimeMin, maxAdvanceDays, holdTtlMin
        actions.ts                   // action settings.update, .addClosedDate, .removeClosedDate, .upsertWorkingHours
        schemas.ts                   // clinicSettingsSchema, workingHourSchema, closedDateSchema
        queries.ts                   // getClinicSettings(), listWorkingHours(), listClosedDates()
        types.ts                     // ClinicSettingsView

    components/
      ui/                            // shadcn primitives, vendored (C17); pruned to exactly what the UI plan uses (Section 8)
        button.tsx
        input.tsx
        label.tsx
        select.tsx                   // revenue granularity, status filter
        calendar.tsx                 // react-day-picker wrapper — booking date-step, closed-dates-form
        dialog.tsx                   // service-form-dialog, reschedule-dialog, generic confirm-dialog
        sheet.tsx                    // mobile admin nav drawer, mobile filters drawer
        dropdown-menu.tsx            // appointment-row-actions, admin user menu
        table.tsx                    // appointments / patients / services tables
        tabs.tsx                     // revenue granularity toggle, calendar view toggle
        badge.tsx                    // status-badge, service active/inactive
        card.tsx                     // KPI cards, landing service/testimonial cards
        form.tsx                     // React Hook Form field wrapper, used by every form across the app
        sonner.tsx                   // toast notifications (shadcn's current recommendation over the deprecated toast.tsx)
        skeleton.tsx                 // every loading.tsx
        separator.tsx                // settings sections, dropdown-menu dividers
        popover.tsx                  // phone-input country combobox, date-range-picker
        alert.tsx                   // inline error banners (SLOT_TAKEN, OTP_SEND_FAILED, settings save failure)
        checkbox.tsx                 // review-step "name and phone are correct" confirmation (brief requirement)
        pagination.tsx               // admin tables (brief requirement)
        tooltip.tsx                  // accessible names for icon-only buttons (WCAG 4.1.2)
        command.tsx                  // searchable country list inside phone-input's popover
                                      // (radio-group pruned: no genuine use — service choice renders as selectable cards, not a radio list)
      page-header.tsx                // title + optional actions slot, every /admin/* page
      empty-state.tsx                // "no appointments match these filters", etc.
      status-badge.tsx               // AppointmentStatus -> color + icon + text label, never color alone (C4, WCAG 1.4.1)
      confirm-dialog.tsx             // generic "are you sure?" wrapping ui/dialog — cancel/no-show, deactivate service
      widget-error-boundary.tsx      // generic data-fetch error wrapper for dashboard widgets (T8.6)
      data-table-pagination.tsx      // ui/pagination wrapper shared by all three admin tables
      date-range-picker.tsx          // ui/popover + ui/calendar range picker — dashboard filter and appointments filter both compose this
      money-display.tsx              // thin span around lib/money.ts formatMoney — landing, booking review, dashboard, appointments table
      site-header.tsx                // public nav: /, /privacy, /terms, /book
      site-footer.tsx                // contact info, clinic hours summary (brief: Footer section) — shared, not landing-local,
                                      // because /privacy and /terms reuse it too
      theme-toggle.tsx               // dark-mode switch (C18 nice-to-have); mounted in both site-header and admin-topbar
      app-logo.tsx                   // mounted in both site-header and admin-sidebar

    hooks/                           // cross-feature client hooks — C17 scopes hooks/ per-feature only; this is a stated
                                      // extension for the handful of hooks no single feature owns (see 3.1)
      use-debounced-value.ts         // appointments-filters and patients search inputs
      use-media-query.ts             // admin sidebar <-> sheet breakpoint switch

    server/
      db.ts                          // PrismaClient singleton, globalThis-cached across HMR reloads
      action.ts                      // defineAction({ input, handler, auth, rateLimit }) (C12): Zod parse -> rate limit ->
                                      // auth -> handler -> error mapping. Declares ActionResult<T> and the shared Paginated<T>,
                                      // DateRange generics here (see 3.1 — "where types live")
      auth-guards.ts                 // requireAdmin() — re-checks the session inside every admin action (C11); distinct from
                                      // the top-level auth.ts/auth.config.ts, which are the Auth.js configuration itself
      audit.ts                       // writeAuditLog(action, entity, entityId, meta) — AuditAction values from C4
      slots/
        availability.ts              // slot-grid builder: WorkingHour + ClosedDate + slotIntervalMin -> candidate UTC instants
                                      // minus taken AppointmentSlot rows (Section 6); DST de-dup rule from C6
        hold-expiry.ts                // lazy sweep: PENDING_VERIFICATION past holdExpiresAt -> CANCELLED, deletes its slots (C9.5)
      sms/
        provider.ts                   // interface SmsProvider { sendOtp, sendConfirmation }
        console-provider.ts           // dev/mock: logs to stdout, never a real send
        twilio-provider.ts             // Twilio implementation
        index.ts                       // selects an implementation by SMS_PROVIDER (C16) — provider selection, not a re-export barrel
      ratelimit/
        limiter.ts                     // interface RateLimiter { limit(key, rule): Promise<Decision> } (C14)
        memory-limiter.ts              // sliding-window Map; dev / single-instance; advisory only on serverless (C14)
        upstash-limiter.ts              // @upstash/ratelimit; prod
        rules.ts                        // the pinned rule table from C14 (availability.read, booking.create, otp.send, ...)
        index.ts                        // selects an implementation by RATE_LIMIT_PROVIDER (C16) — provider selection, not a barrel
      appointments/
        transitions.ts                  // legal AppointmentStatus transition matrix + assertTransition() guard (C4)
        reschedule.ts                   // delegates to rescheduleAppointment, Section 6.5 (T9.4)

    lib/
      env.ts                          // Zod-parses process.env once; the ONLY file allowed to read process.env (C16, ESLint-enforced)
      clock.ts                        // interface Clock { now(): Date }; systemClock + FixedClock test double (C22)
      money.ts                        // formatMoney(minor, currency, locale) — exponent from Intl, never hardcoded /100 (C7)
      dates.ts                        // date-fns-tz boundary wrappers: fromZonedTime, toZonedTime, formatInTimeZone (C6)
      phone.ts                        // libphonenumber-js: parse/validate E.164, country list for the phone-input selector
      ics.ts                          // hand-rolled RFC 5545 .ics writer, no dependency (C2)
      enums.ts                        // AppointmentStatus / BookingSource / AdminRole / AuditAction const objects + Zod unions (C4)
      errors.ts                       // ErrorCode union + ActionError shape (C12)
      logger.ts                       // pino + redaction serializer; never logs phone/name/OTP/password/token/reference (C19)
      utils.ts                        // cn() class-merge helper (clsx + tailwind-merge) and small array/pagination helpers
      reference.ts                    // "MB-XXXXXX" generator, Crockford-32-minus-vowels alphabet, rejection sampling (C8)

    content/
      site.ts                        // landing copy, FAQ, testimonials, doctors — single config source (C17); Services
                                      // themselves come from the DB (seed.ts), not from this file

  prisma/
    schema.prisma                    // Postgres — single source of truth for schema + migrations (C3)
    schema.sqlite.prisma             // generated by scripts/gen-sqlite-schema.ts; gitignored, never hand-edited (C3)
    migrations/
      migration_lock.toml
      "20250101000000_catalog_init"/
        migration.sql                // Service, ClinicSettings, WorkingHour, ClosedDate — first migration (T3.2, 4.6)
      "20250102000000_booking_core_init"/
        migration.sql                // Patient, Appointment, AppointmentSlot — second migration (T4.1)
      "20250103000000_add_check_constraints"/
        migration.sql                // hand-edited: the six CHECK-constraint statements from Section 4.5, as a migration
                                      // of its own, not folded into catalog_init (T4.2, 4.6 step 3)
      "20250104000000_admin_audit_init"/
        migration.sql                // OtpChallenge, AdminUser, AuditLog — fourth migration, completes the 9-model schema (T4.3)
    seed.ts                          // sample services, sample appointments across statuses, one admin user (brief "Delivery")

  scripts/
    gen-sqlite-schema.ts             // rewrites datasource provider + url into prisma/schema.sqlite.prisma (C3)
    retention.ts                     // monthly cron: anonymize appointments >24mo, hard-delete stale patients / expired OTP rows (C20)

  tests/
    unit/
      lib/
        money.test.ts
        dates.test.ts
        phone.test.ts
        enums.test.ts
        ics.test.ts
      server/
        slots/
          availability.test.ts       // Section 6 edge cases: DST spring-forward/fall-back, overlapping durations, closed days
          hold-expiry.test.ts
          hold-expiry.integration.test.ts // Section 11.5 integration tier: lazy sweep vs cron under real DB (T11.2)
        appointments/
          transitions.test.ts        // every legal/illegal transition pair from C4
          reschedule.integration.test.ts // Section 11.5 integration tier: reschedule success + rollback-on-collision (T11.2)
        auth/
          require-admin.integration.test.ts // Section 11.5 integration tier: requireAdmin() rejection cases, row left unmutated (T11.2)
        booking/
          concurrency.integration.test.ts // Section 11.5 integration tier: Promise.all double createBooking -> one SLOT_TAKEN (T11.2)
        dashboard/
          kpi-accuracy.integration.test.ts // dashboard KPI aggregate vs hand-computed totals under real DB (T8.7)
        settings/
          audit-coverage.integration.test.ts // every settings mutation path writes its AuditLog row (T10.7)
        otp.test.ts                  // expiry, maxAttempts, resend cooldown/replacement (C10)
        ratelimit.test.ts
      features/
        booking/
          schemas.test.ts
    component/
      booking/
        service-step.test.tsx
        date-step.test.tsx
        time-step.test.tsx
        details-step.test.tsx
        review-step.test.tsx
      admin/
        kpi-cards.test.tsx
        appointments-table.test.tsx
    e2e/
      booking-flow.spec.ts           // Section 11: full happy-path booking incl. OTP
      double-booking.spec.ts         // Section 11: concurrent-slot race
      admin-login.spec.ts
      admin-dashboard-kpis.spec.ts
      admin-appointments-actions.spec.ts
    fixtures/
      services.ts
      appointments.ts
      admin-user.ts
      clinic-settings.ts
    support/
      integration-setup.ts           // per-worker-schema + TRUNCATE isolation harness for the "integration" Vitest project (T11.4)

  public/
    favicon.ico
    images/
      hero.jpg                       // LCP image, next/image priority (C23)
      doctors/                       // "doctors/*.jpg" — About section headshots, several files not individually enumerated

  .github/
    workflows/
      ci.yml                        // lint -> typecheck -> unit -> component -> build -> e2e -> Lighthouse CI, on every PR
    pull_request_template.md         // includes the C19 checklist item: "any new log line touching patient data reviewed for PII"

  docs/
    PLAN.md                          // this document (Sections 1-14) — assembled output, not authored directly by this fragment
```

### 3.1 Conventions

- **File naming.** Kebab-case for every `.ts`/`.tsx` file (`review-step.tsx`, not `ReviewStep.tsx`). Route-segment folders use the exact lowercase URL segment; dynamic segments keep Next's bracket syntax (`"[reference]"`).
- **Component naming.** One component per file, PascalCase, name matches the filename (`booking-summary-card.tsx` exports `BookingSummaryCard`). No default exports for components — named exports only, so an import error names the symbol, not just "default."
- **Barrel-file policy: banned.** No `index.ts` re-export barrels under `features/`, `components/`, or `lib/` — every import is a direct path to one physical file, which is what lets Section 12's "files touched" column name a single real path per change. The two `index.ts` files that do exist (`server/sms/index.ts`, `server/ratelimit/index.ts`) are provider-*selection* modules (`export const smsProvider = env.SMS_PROVIDER === "twilio" ? twilioProvider : consoleProvider`), not re-exports of sibling files, so they don't reintroduce the barrel problem.
- **Where types live.** `@prisma/client`'s generated types are the base vocabulary. Per-feature view/input shapes live in that feature's `types.ts`, inferred from its `schemas.ts` Zod schemas wherever one exists (`z.infer<typeof x>`), never hand-duplicated. Cross-feature generics that aren't owned by any one feature (`Paginated<T>`, `DateRange`) live in `src/server/action.ts` beside `ActionResult<T>`, since every paginated or range-filtered read is itself a Server Action's input or output.
- **Import alias.** `"@/*"` → `"src/*"` (tsconfig `paths`, mirrored in `vitest.config.ts` and `playwright.config.ts` resolvers). Example: `import { db } from "@/server/db"`; `import { ReviewStep } from "@/features/booking/components/review-step"`.
- **Route-private colocation.** A `_folder` prefix (e.g. `app/admin/(dashboard)/_components/`) colocates files used by exactly one route segment and its children, opted out of Next's routing. Anything imported by two or more features or route segments graduates to `src/components/` (or `src/hooks/`) instead.
- **Assumption — `middleware.ts` location.** The task framing groups `middleware.ts` with repository-root config, but Next.js requires it at the same filesystem level as `app/`; since C17 nests `app/` under `src/`, `middleware.ts` is placed at `src/middleware.ts`, not the bare repo root. Functionally identical; this is a placement detail, not a deviation from C11's matcher behavior.
- **Assumption — generated SQLite schema.** `prisma/schema.sqlite.prisma` is listed in `.gitignore` and regenerated on demand by `pnpm db:sqlite`; it is build output of `scripts/gen-sqlite-schema.ts`, not a hand-maintained file (C3).
- **Assumption — `src/hooks/`.** C17 only names `hooks/` inside each `features/<feature>/`. Two hooks (debounce, media-query breakpoint) are genuinely cross-feature with no single owning feature; rather than duplicate them per-feature or force an artificial owner, they live in a sibling `src/hooks/`. This is additive to C17, not a substitute for the per-feature `hooks/` convention.
- **Assumption — static images.** Doctor photos and the landing hero image are plain files under `public/images/`, consumed via `next/image` with an explicit `src="/images/..."` path (not static `import`). Keeps the asset pipeline simple; no build-time image processing step is introduced.

### 3.2 File count budget

Approximate, source-file count (excludes config/lockfiles already itemized above and generated output):

| Area | Files (approx.) |
|---|---|
| `src/app` (routes incl. loading/error/not-found/route handlers) | 38 |
| `src/features` (9 features) | 66 |
| `src/components/ui` (shadcn primitives) | 22 |
| `src/components` (shared composites) | 12 |
| `src/hooks` (shared) | 2 |
| `src/server` | 17 |
| `src/lib` | 11 |
| `src/` top-level + `src/content` (`auth.ts`, `auth.config.ts`, `middleware.ts`, `site.ts`) | 4 |
| `public/` | ~6 |
| `prisma/` | 8 |
| `scripts/` | 2 |
| `tests/` (unit + component + e2e + fixtures + support) | 34 |
| Root config (`package.json` … `.gitignore`) | 15 |
| `.github/` | 2 |
| `docs/` + `README.md` | 2 |
| **Total** | **~241** |

`src/features` and `src/app` together are ~45% of the tree — expected for a feature-sliced, per-route-rendering-strategy app with no shared "pages" abstraction. The 9-feature split keeps no single feature above ~13 files (`booking`, the largest, carries the 5-step wizard plus the phone-input composite it uniquely owns).
