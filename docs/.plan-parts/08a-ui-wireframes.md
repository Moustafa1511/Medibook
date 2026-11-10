## 8. UI Plan

This section specifies every screen in C15's route table. 8.1 (below) is the page-by-page wireframe catalogue: layout, content, responsive behaviour, states, accessibility. 8.2 (separate fragment) is the component inventory against Section 3's paths; 8.3 maps design tokens to Tailwind, including C18's contrast table. This fragment covers 8.1 only, naming primitives without restating their props or tokens.

### 8.1 Page-by-page wireframes

**Shared conventions.** Breakpoints are Tailwind defaults (`sm` 640/`md` 768/`lg` 1024/`xl` 1280px); desktop diagrams are at `lg`, mobile at sub-`sm`. Every page reuses `PageHeader`, `EmptyState`, `StatusBadge`, `MoneyDisplay`, `ui/skeleton.tsx` and the one Sonner toast region (8.1.18) — not re-described per page. Touch targets are >=44px on `sm`/`md` (practical baseline, not AA-mandated). Status colour mapping (used throughout, matching 8.3.7's canonical table): `PENDING_VERIFICATION`->Warning `#F59E0B`, `CONFIRMED`->Info `#0EA5E9`, `COMPLETED`->Success `#16A34A`, `CANCELLED`->Danger `#DC2626`, `NO_SHOW`->neutral slate (`muted-foreground`, reusing an existing neutral tone rather than a fifth hue — see Contract Challenges). Status is icon+text, never colour alone (WCAG 1.4.1).

**Shared accessibility baseline** (assumed below, not repeated per page). Landmarks: public pages use `<header>`/`<nav aria-label="Primary">`/`<main>`/`<footer>`; admin pages use `<nav aria-label="Admin">` (sidebar) plus one `<main>` per route; a visually-hidden "Skip to content" link precedes every header. Focus order follows DOM order; a step/tab/dialog change moves focus to the new region's heading. Labels are a visible `<label>`/`<legend>` bound by `for`/`aria-describedby`, never a placeholder. One `aria-live="polite"` region per page announces async-action results; a blocking failure uses `role="alert"` instead. Per-page notes cover only what deviates from this baseline.

#### 8.1.1 Landing page — `/`

**Purpose.** Convert a visitor into a booking in one scroll pass via the "Book Appointment" CTA.

```
+----------------------------------------------------------------+
| LOGO MediBook  Services About How-it-works FAQ [Book Appt]      |
+----------------------------------------------------------------+
| HERO "Book your visit in under two minutes."  [Book Appt ->]    |
| SERVICES (3-col, sortOrder) [Gen.Consult 30m EUR50] [Dental..]   |
| ABOUT/DOCTORS  3 photo+name+specialty cards                      |
| HOW IT WORKS  (1) Choose service (2) Confirm by SMS (3) Visit    |
| TESTIMONIALS  "Booking took two minutes." - Johanna K.          |
| HOURS/LOCATION  Mon-Fri 09-18, Sat 09-13 & 16-20, Sun closed    |
| FAQ  <details><summary>How do I reschedule?</summary>...</details> |
| FOOTER  MediBook | phone | email | Privacy | Terms              |
+----------------------------------------------------------------+
```

**Content, brief order (8 sections).** Hero — H1, subhead, CTA to `/book`; `hero.jpg` is the LCP image (`priority`, C23). Services — one card per active `Service`, `sortOrder`-ordered: name, duration, `MoneyDisplay(priceMinor)`, description; "Select" deep-links `/book?service=<slug>`. About/Doctors — static copy + placeholder doctor grid (not modelled, C1). How It Works — 3 numbered steps per the brief. Testimonials — 3 short quotes, first name + initial. Hours & Location — built from `WorkingHour`/`ClinicSettings` at build time, Saturday split as two ranges; address, `mapUrl`, `phoneE164`. FAQ — zero-JS `<details>/<summary>`, 5 items (reschedule/cancel directs to phone; no patient self-service route exists, C1/C13). Footer — reused on `/privacy`/`/terms`.

**Responsive.** `sm`: 1-col stacked, nav behind a `Sheet` hamburger. `md`: Services/Doctors 2-col. `lg`/`xl`: 3-col grids, max-width 1280px.

**States.** Loading: none (SSG, C15). Empty: zero active services -> `EmptyState` ("Services are being updated"), per 6.6. Error: none. Success: default render.

**Accessibility.** One `<h1>`; each section is `<section aria-labelledby>` its own `<h2>`; nav is `<nav aria-label="Primary">`; Select links name the service; images carry descriptive `alt`.

#### 8.1.2 `/privacy` and `/terms`

**Purpose.** Legal disclosure (C20's retention policy on `/privacy`); findability over conversion.

```
+------------------------------------------+
| site-header (nav only)                     |
| H1 Privacy Policy    Last updated: <date>  |
| H2 What we collect | H2 Retention |        |
| H2 Your rights | H2 Contact                |
| site-footer                                |
+------------------------------------------+
```

**Content.** `/privacy`: data collected (name, phone, appointment history — not payment or medical data, C1), retention periods in plain language (C20), Twilio as the only third party. `/terms`: booking/cancellation/no-show terms.

**Responsive.** Single-column prose, ~72ch measure, at all widths.

**States.** SSG — no loading/empty/error; success is the only render.

**Accessibility.** One `<h1>`, sequential `<h2>`s, `<main>` landmark, visible focus outlines.

#### 8.1.3 `/book` — wizard shell

**Purpose.** Hold the 5-step wizard (Service/Date/Time/Details/Review) plus OTP behind one static shell (`force-static`, C15) so step changes stay client-side.

```
+------------------------------------------------------------+
| site-header (logo + "Need help? <phone>" only)               |
| (1)-(2)-(3)-(4)-(5)-(6) Service Date Time Details Review Verify |
| [x] [x] [o] [ ] [ ] [ ]           <- stepper                 |
|              << step content area >>                          |
| [ <- Back ]                           [ Continue -> ]          |
+------------------------------------------------------------+
```
Mobile:
```
+----------------------------+
| <- MediBook   Need help?   |
| Step 3 of 6: Time          |
| [=====------]              |
|       step content         |
| [ Back ]      [ Continue ] |
+----------------------------+
```

**Content.** Header: wordmark + phone link, no nav. Stepper nodes check off once complete; current step is solid `#0F766E`/white (AA-safe, C18 — never raw `#0D9488` with white text). Footer nav: Back (hidden step 1), Continue (disabled until local validation passes; relabels "Confirm & Send Code"/"Verify" on the last two steps).

**Responsive.** `sm`: progress bar + "Step N of 6", full-width buttons. `md`: 4-of-6 abbreviated labels. `lg`/`xl`: full labelled 6-node stepper, content capped ~720px.

**States.** Loading: `loading.tsx` skeleton shell during hydration. Error: `error.tsx` is a backstop only — failures are typed `ActionResult`s rendered in-step (C12), never thrown. Empty/Success: owned by individual steps.

**Accessibility.** One visually-hidden `<h1>`; each step (8.1.4-8.1.10) renders its own `<h2>` as the step prompt, so order is always h1 > h2 regardless of which step is active. Stepper is `<nav aria-label="Booking steps"><ol>` with `aria-current="step"`; the shared live region announces step transitions and validation errors; disabled Continue is `aria-disabled` with visible helper text.

#### 8.1.4 `/book` — Step 1: Service

**Purpose.** Capture `serviceId`, required input to every later slot computation (Section 6).

```
+--------------------------------------------+
| "What can we help you with?"                |
| [o Gen.Consult 30m EUR50] [o Dental 45m..]   |
| [o Phys.Therapy 60m EUR90] ...  radiogroup   |
+--------------------------------------------+
```

**Content.** One card per active `Service`, `sortOrder`-ordered: name, duration, `MoneyDisplay`, description. Selecting highlights the card and enables Continue; never auto-advances.

**Responsive.** `sm`/`md`: 1-col full-width cards. `lg`/`xl`: 3-col grid.

**States.** Loading: 6 skeleton cards. Empty: zero active services -> `EmptyState` ("No services bookable online"), per 6.6. Error: generic failure -> inline `Alert`+retry. Success: default grid, nothing selected.

**Accessibility.** Cards are `role="radiogroup"`/`radio` with `aria-checked`, arrow-key nav; price/duration are in each card's name.

#### 8.1.5 `/book` — Step 2: Date

**Purpose.** Narrow to one date, pre-disabling dates the engine already knows are unbookable (6.2).

```
+--------------------------------------------+
| "Pick a date"             < January 2026 >  |
| Su Mo Tu We Th Fr Sa                        |
|    1* 2  3  4  5  6*    * closed/past       |
| Legend: [dot] closed  [x] fully booked       |
+--------------------------------------------+
```

**Content.** `react-day-picker` grid (C2); `disabled` fed by `getAvailableDays` (6.2) — one of `PAST`/`BEYOND_WINDOW`/`CLOSED_DATE`/`NO_WORKING_HOURS`/`LEAD_TIME`/`FULLY_BOOKED`, rendered identically since the distinction adds no patient action. Month change re-fetches.

**Responsive.** `sm`: 44px min cells, single-letter weekday headers (full name hidden for AT). `lg`/`xl`: larger cells, 3-letter headers.

**States.** Loading: grid renders immediately, a thin skeleton marks availability until resolved (~100ms, C23). Empty: whole month disabled -> `EmptyState` ("No availability this month"). Error: `RATE_LIMITED`/`INTERNAL` -> inline `Alert`, grid stays on last valid month. Success: >=1 enabled day; selection advances prefetch.

**Accessibility.** `role="grid"`/`gridcell`, disabled cells carry `aria-disabled` + a reasoned `aria-label` ("January 6, closed"), stay in the roving-tabindex sequence; month-nav buttons have real names.

#### 8.1.6 `/book` — Step 3: Time

**Purpose.** Resolve to one start instant. **Assumption**: periods are Morning `<12:00`, Afternoon `12:00-17:00`, Evening `>=17:00`, clinic-local (C6).

```
+--------------------------------------------+
| "Available times - Tue, Jan 20"             |
| Morning   [09:00][09:15][09:30][09:45]       |
| Afternoon [13:00][13:15][14:00]              |
| Evening   [17:00][17:15]                     |
+--------------------------------------------+
```
Mobile:
```
+----------------------------+
| Tue, Jan 20 — Morning       |
| [09:00] [09:15] [09:30]    |
| Afternoon                  |
| [13:00] [13:15] [14:00]    |
| Evening  [17:00] [17:15]   |
+----------------------------+
```

**Content.** Each button shows `displayLocal` (clinic-local, C6); a caption states the zone once.

**Responsive.** `sm`: full-width wrapped buttons, periods stack. `md`: 2 periods/row. `lg`/`xl`: 3-column.

**States.** Loading: 8-12 skeleton pills under the three headings. Empty: zero slots -> `EmptyState` ("Fully booked for this day") + link back to Step 2 (Section 6.6's `FULLY_BOOKED`). Error: `VALIDATION_ERROR`/`INTERNAL` -> inline `Alert`, retry. Success: grid renders; a previously-picked slot stays highlighted if still present, otherwise absent (not 8.1.10's `SLOT_TAKEN` failure).

**Accessibility.** Each period is `<section aria-labelledby>` its own `<h3>`; slots form one `role="radiogroup"` per period, labelled fully ("9:00 AM, available").

#### 8.1.7 `/book` — Step 4: Patient details

**Purpose.** Collect full name and SMS-reachable phone (brief's Step 4).

```
+--------------------------------------------+
| "Your details"                               |
| Full name [ Jane Doe___________ ]             |
| Phone     [DE +49 v][30 1234 5678______]      |
| We'll text a 6-digit code to confirm.          |
+--------------------------------------------+
```

**Content.** Name: single input, inline Zod on blur. Phone: country `Combobox` (flag+dial code, default `CLINIC_DEFAULT_COUNTRY`, C16) + national-number input, validated E.164 (`lib/phone.ts`, C12).

**Responsive.** `sm`: fields stack full-width, popover becomes a `Sheet`. `md`+: inline.

**States.** Loading: n/a. Empty: both blank; Continue disabled until valid. Error: field-level `fieldErrors` under each input. Success: Continue enables.

**Accessibility.** Visible `<label>`s, not placeholder-as-label; combobox typeable/arrow-selectable; invalid fields get `aria-invalid`+`aria-describedby`.

#### 8.1.8 `/book` — Step 5: Review & confirm

**Purpose.** Force an explicit check of name/phone before any SMS is sent (the brief's confirmation gate).

```
+--------------------------------------------+
| "Review your booking"                        |
| Service  General Consultation                 |
| Date     Tue, Jan 20, 2026   Price EUR50.00    |
| Time     09:00 (CET)                           |
| Name     Jane Doe                [Edit]        |
| Phone    +49 30 1234 5678        [Edit]        |
| [ ] I confirm the name and phone above          |
|     are correct.                                |
| [ Confirm & Send Code -> ]  (disabled unchecked) |
+--------------------------------------------+
```

**Content.** Static summary of every field; each "Edit" returns to its owning step without discarding later state. The checkbox gates submit, which calls `booking.createBooking` (C9.2): success advances to OTP; `SLOT_TAKEN` routes to 8.1.10.

**Responsive.** `sm`: rows stack label-above-value, Edit becomes labelled icon buttons. `lg`/`xl`: two-column rows.

**States.** Loading: submit shows "Sending code...", disables Edit links. Empty: n/a. Error: `VALIDATION_ERROR` names the field; `RATE_LIMITED` -> generic retry-later copy; `SLOT_TAKEN` -> full handoff to 8.1.10, not an inline alert. Success: advances with the new `appointmentId`.

**Accessibility.** Checkbox's sentence is its label; disabled submit pairs with visible helper text, not styling alone.

#### 8.1.9 `/book` — Step 6: Verify (OTP)

**Purpose.** Prove phone reachability before `CONFIRMED` (C9.4).

```
+--------------------------------------------+
| "Enter the code sent to +49 30 ****5678"      |
| [1][2][3][4][5][6]                            |
| Resend code in 0:47                            |
| [ Verify -> ]                                  |
+--------------------------------------------+
```

**Content.** Six auto-advancing digit boxes feed `otp.verifyOtp`; phone is masked in the heading. Resend shows a live 60s countdown (C10), activating at `0:00`, capped at 3 resends — the 4th disables it ("Maximum resend attempts reached," C10). (No separate mobile diagram; no structural change beyond the shell, 8.1.3.)

**States, by code.** Loading: "Verifying…", boxes disabled. Empty: Verify disabled until all 6 digits are filled. `OTP_INVALID`: "That code didn't match" (no attempts-remaining counter, C12). `OTP_EXPIRED`/`OTP_MAX_ATTEMPTS`: the same generic "This code has expired," deliberately undistinguished (C10). `HOLD_EXPIRED`: a distinct blocking panel, "Your hold expired — pick a new time," back to Step 3 with service/date preserved. `OTP_SEND_FAILED`: inline `Alert`; cooldown still runs from `OtpChallenge.lastSentAt` (assumption: starts at creation, not at send success). Success: redirect to `/book/success/[reference]`.

**Accessibility.** Boxes are one `fieldset`/`legend`, each `aria-label="digit N of 6"`; the countdown itself isn't `aria-live` — only the terminal "now available" transition is announced; auto-advance moves visual and keyboard focus together.

#### 8.1.10 `/book` — `SLOT_TAKEN` recovery

**Purpose.** Recover from the 6.4 race: the slot's `AppointmentSlot` insert hit `P2002` since another booking committed first; reached from Step 5's submit, not a separate route.

```
+--------------------------------------------+
| (!) "That time was just booked by someone     |
|      else" — your other details are saved.    |
| Morning   [09:15][09:30][09:45]                |
| [ <- Choose a different date ]                  |
+--------------------------------------------+
```

**Content.** Warning-coded panel (expected race, not a fault) replaces the review card in place, re-rendering Step 3's grid via a fresh `getAvailableSlots`; picking a slot returns to Step 5 with the new time merged in.

**Responsive.** Same single-column panel at all widths; grid follows 8.1.6's own rules.

**States.** Loading: same skeleton pills as 8.1.6. Empty: day now fully booked -> 8.1.6's own `EmptyState`. Error: second failure -> inline `Alert`+retry. Success: new slot chosen -> returns to Step 5 (**assumption**: checkbox stays checked, since the time change doesn't affect name/phone).

**Accessibility.** Focus moves to the panel heading; the shared live region announces the change.

#### 8.1.11 `/book/success/[reference]`

**Purpose.** Confirm `CONFIRMED`, hand over the reference as a durable lookup token (C8); no account required (C1).

```
+--------------------------------------------+
| (check) "You're booked, Jane!"                |
| Reference  MB-7K3F9Q        [Copy]             |
| Service    General Consultation                |
| When       Tue, Jan 20, 2026, 09:00 (CET)       |
| Price      EUR 50.00                            |
| [ Add to Calendar (.ics) ]                       |
| What happens next                                |
| - Confirmation text sent to +49 30 ****5678    |
| - To reschedule or cancel, call <phone>          |
+--------------------------------------------+
```

**Content.** Summary mirrors Step 5's shape plus the final `reference` + `Copy`; "Add to Calendar" anchors to `GET /api/appointments/[reference]/ics` (file download via `Content-Disposition`, C13, not a client fetch); "What happens next" routes any change to a phone call, since no patient-side reschedule/cancel action exists (C1/C13).

**Responsive.** `sm`: rows stack, buttons full-width. `lg`/`xl`: inline.

**States.** Loading: dynamic SSR (`no-store`, C15), brief skeleton. Error: unknown/malformed `reference` -> route's own `not-found.tsx`, rate-limited 30/1h/IP (C14), copy that neither confirms nor denies the reference ever existed. Success: rendered state above.

**Accessibility.** `<h1>` is the greeting; the reference carries `aria-label="Booking reference"`; Copy announces via the toast region; the `.ics` link's name clarifies it downloads a file.

#### 8.1.12 `/admin/login`

**Purpose.** Gate `/admin/*` behind email+password (C11); never distinguish "no such email" from "wrong password."

```
+----------------------------+
|   Admin sign in             |
|   Email    [___________]    |
|   Password [___________]    |
|   [ Sign in ]                |
+----------------------------+
```

**Content.** Single centered card, no self-service reset (seed-only accounts, C1); success redirects to `?next=` if same-origin, else `/admin`.

**Responsive.** `sm`: full-width card minus gutter. `lg`/`xl`: fixed ~400px centered.

**States.** Loading: spinner, fields disabled. Empty: submit disabled until both filled. Error: single generic "Invalid email or password" for both failure types; a distinct lockout message when `lockedUntil` is active; a distinct rate-limit message (C14). Success: redirect, no in-page success state.

**Accessibility.** Visible labels; one `role="alert"` per attempt, `aria-describedby` on the form (not per-field); `autocomplete` set.

#### 8.1.13 `/admin` — dashboard

**Purpose.** One-screen snapshot of patients, revenue, and load over a selectable date range.

```
+------------------------------------------------------------+
| admin-sidebar | "Dashboard"        [date range: Last 30d v]  |
| [Patients 248][Revenue EUR12,450][Expected EUR3,100]          |
| [Today 6][Upcoming this wk 22]                                |
| [Revenue over time D|W|M]   [Appointments by service]          |
+------------------------------------------------------------+
```
Mobile:
```
+----------------------------+
| =  Dashboard   [range v]   |
| Patients            248    |
| Revenue         €12,450    |
| Expected         €3,100    |
| Today's Appts        6     |
| Upcoming This Wk     22    |
| Revenue chart   [D|W|M]    |
| Appts by service chart     |
+----------------------------+
```

**Content.** Five KPI cards (brief Section 3): Total patients, Total revenue (`COMPLETED` sum), Expected revenue (upcoming `CONFIRMED` sum), Today's appointments, Upcoming this week — label+number+icon. Two charts: Revenue over time (D/W/M toggle); Appointments by service as ranked bars in each service's seeded `colorHex`. One topbar date-range filter re-queries all 7 widgets via `searchParams` — never per-widget.

**Responsive.** `sm`: shown above (1-col cards, stacked charts, range -> `Sheet`). `md`: 2-col KPI cards. `lg`/`xl`: 5-across row, charts 50/50.

**States.** Loading: 5 skeleton cards + 2 skeleton charts (<400ms p95, C23). Empty: zero-appointment range renders true "0" values, charts show "No data in this range." Error: one widget's own `Alert`+retry; a failing chart never takes down the others. Success: default render.

**Accessibility.** Date-range control's name states its scope; one batched live-region announcement covers all 7 widgets; each KPI's name includes label+unit; charts carry a summarizing `aria-label` plus a hidden data-table equivalent.

#### 8.1.14 `/admin/calendar`

**Purpose.** See booked time as a day/week/month grid, colour-coded by status.

```
+------------------------------------------------------------+
| admin-sidebar | "Calendar" [Day|Week|Month]   < Jan 20 >    |
| Mon [CONFIRMED J.Doe]                                         |
| Tue      [PENDING hold]    [COMPLETED Dental]                 |
| Legend: Pending Confirmed Completed No-show(o) Cancelled       |
+------------------------------------------------------------+
```

**Content.** FullCalendar (daygrid/timegrid, C2) in a client island; `calendar-view-toggle.tsx` drives day/week/month. Event blocks show status+patient initials+service in the shared colour mapping, legend always visible beneath; clicking opens the same row-action menu as `/admin/appointments`.

**Responsive.** `sm`/`md`: defaults to Day view, toggle becomes a `Select`. `lg`/`xl`: defaults to Week, full 3-button toggle.

**States.** Loading: skeleton matching the current view's grid. Empty: zero events renders the bare grid (itself informative). Error: inline `Alert`, grid keeps its last-good view. Success: populated grid.

**Accessibility.** FullCalendar's native ARIA grid semantics are used as-is; view toggle is `role="tablist"`/`tab`; each event's name includes status+time+patient/service.

#### 8.1.15 `/admin/appointments`

**Purpose.** Find and act on any appointment — confirm/complete/no-show/cancel/reschedule — without leaving the list.

```
+------------------------------------------------------------+
| admin-sidebar | "Appointments"                                |
| [Search name/phone/ref___] [Status v][Service v][Range v]      |
| Ref       Patient  Service      Date/Time  Status      •••     |
| MB-7K3F9Q J. Doe   Gen.Consult  1/20 09:00 [CONFIRMED]          |
|                < Prev  1 2 3 ... 9  Next >                      |
+------------------------------------------------------------+
```
Mobile:
```
+----------------------------+
| =  Appointments [Filters]  |
| [ Search_______________ ]  |
| MB-7K3F9Q      [CONFIRMED] |
| J. Doe · Gen.Consult   ••• |
| Jan 20, 09:00               |
|      < 1 2 3 ... 9 >        |
+----------------------------+
```

**Content.** Search (name/phone/reference, plain scan per 4.7's gap) + status/service/date-range filters, all `searchParams`-driven (C15); row: reference, patient, service, date/time, `StatusBadge`, row-actions offering exactly the legal next transitions (C4 — `COMPLETED` offers none). "Reschedule" opens `reschedule-dialog.tsx`, re-embedding 8.1.5/8.1.6's pickers scoped to the existing service.

**Responsive.** `sm`: shown above (card list, filters in a `Sheet`, dialog -> full-height sheet). `md`: table returns, service column drops to a secondary line. `lg`/`xl`: full table.

**States.** Loading: skeleton rows/cards. Empty: no filter matches -> `EmptyState` ("No appointments match these filters," distinct from a true zero-appointment state). Error: a row action failure (`INVALID_TRANSITION`, `SLOT_TAKEN` on reschedule) toasts and rolls the optimistic row back. Success: toast confirms, row updates in place.

**Accessibility.** A real `<table>`, not div-grid; row-actions button names the row ("Actions for MB-7K3F9Q"); the dialog is `role="dialog"`/`aria-modal`, focus-trapped, returned on close.

#### 8.1.16 `/admin/patients`

**Purpose.** Read-only roster: who is this patient, what's their history. No mutation exists here (C1, Section 3).

```
+------------------------------------------------------------+
| admin-sidebar | "Patients"                                    |
| [ Search name or phone__________ ]                            |
| Name    Phone          Visits  Total spent   Last visit        |
| J. Doe  +49 30 ****5678  4      €220.00       Jan 20            |
+------------------------------------------------------------+
```

**Content.** Search by name or phone (same caveat as 8.1.15); the brief's five columns, no row actions, no drill-in page (none specified). Phone masked as in 8.1.9.

**Responsive.** `sm`: table -> stacked cards. `lg`/`xl`: full 5-column table.

**States.** Loading: skeleton rows. Empty: no search match -> `EmptyState`; zero patients at all -> distinct `EmptyState` ("No patients yet"). Error: page-level `Alert`+retry. Success: populated table.

**Accessibility.** Native `<table>`; masked phone's accessible name repeats the same masked string shown visually (privacy-motivated).

#### 8.1.17 `/admin/settings`

**Purpose.** Edit the clinic's operating parameters — hours, closures, scheduling grid, service catalogue — everything Section 6 reads as live config.

```
+------------------------------------------------------------+
| admin-sidebar | "Settings"                                    |
| [Hours][Closed Dates][Slot Interval][Services]  <- tabs        |
| Monday    09:00-18:00         [+Add shift] [Closed]            |
| Saturday  09:00-13:00 [+]     [+Add shift] [Closed]            |
|           16:00-20:00 [x]       (split shift)                   |
|                                   [ Save hours ]                 |
+------------------------------------------------------------+
```

**Content, by tab.** Hours — one row per weekday, open/close pairs ("+Add shift" appends a split row, matching the seeded Saturday pattern, 4.6), plus a "Closed" toggle; writes `WorkingHour`. Closed Dates — date+reason picker, removable list; removal never touches existing bookings. Slot Interval — named for the brief's field but editing all of `ClinicSettings` (`clinicName`/`timeZone`/`currency`/`slotIntervalMin`/`bufferMin`/`minLeadTimeMin`/`maxAdvanceDays`/`holdTtlMin`, `general-settings-form.tsx`), interval first (assumption: the brief names only that one field). Services — table of all `Service` rows + a "New service" dialog (name, duration, price, colour, active toggle); "Deactivate" flips `isActive`, never deletes, and propagates to the landing page via `revalidatePath('/')` (2.3).

**Responsive.** `sm`: tabs become a scrollable pill row, forms stack 1-col. `lg`/`xl`: fixed tab row, 2-col grids where fields are short.

**States.** Loading: skeleton matching the active tab. Empty: Closed Dates empty -> `EmptyState`; Services at zero echoes 8.1.1/8.1.4's "no bookable services" state. Error: `fieldErrors` inline + toast; client Zod (shared schema, C17) catches most before the request is sent. Success: toast confirms, tab re-renders from the server response, never optimistic.

**Accessibility.** Tabs are `role="tablist"`/`tab`/`tabpanel` with roving tabindex, matching the dashboard's toggle; each weekday toggle names the day; saves/errors route through the shared toast/alert pattern.

#### 8.1.18 Global shell

**Public header/footer** (`site-header.tsx`, `site-footer.tsx`). Header: logo to `/`, nav to the landing page's own section anchors, an always-visible "Book Appointment" CTA, `theme-toggle.tsx`; collapses to a `Sheet` on `sm`. The wizard shell (8.1.3) drops nav/toggle to reduce mid-flow exits. Footer: clinic contact + `/privacy`/`/terms`, reused verbatim on both.

**Admin sidebar/topbar** (`admin-sidebar.tsx`, `admin-topbar.tsx`, `admin-nav-items.ts`). Sidebar: logo + one item per nav entry (Dashboard/Calendar/Appointments/Patients/Settings), active route highlighted; collapses to an off-canvas `Sheet` on `sm`/`md`. Topbar: page title, user menu, theme toggle. This chrome is cosmetic — middleware plus `requireAdmin()` are the real gate (C11).

**Toast region** (`ui/sonner.tsx`, root `layout.tsx`). One stack (bottom-corner desktop, bottom-full-width mobile); success/info toasts are `role="status"`/`aria-live="polite"`, destructive outcomes `role="alert"`; auto-dismiss ~5s except unacknowledged errors — the one transient-confirmation mechanism used throughout.

**Not-found/error boundaries** (Section 3's `not-found.tsx`/`error.tsx` at root, `/book`, `/book/success/[reference]`, admin `(dashboard)`). Root `not-found.tsx` keeps the public shell with a link to `/`. Root `error.tsx` is a last-resort boundary for genuine bugs — action failures are already typed `ActionResult`s (C12); the two scoped files follow the same pattern.

#### Contract Challenges

C18 pins exactly four semantic status colours (Success/Warning/Danger/Info), but C4 defines five `AppointmentStatus` values. This section follows 8.3.7's resolution rather than independently inventing one: `CANCELLED` reuses Danger `#DC2626` (one of the four pinned colours) and `NO_SHOW` reuses the existing `muted-foreground` neutral tone, since icon+text already distinguishes the two (WCAG 1.4.1) and a fifth hue would be redundant. The underlying gap stands regardless — C18 should either name a fifth token itself or explicitly bless this reuse-the-neutral approach as the contract's own answer, rather than leaving two independently authored sections to converge on it by chance.
