## 9. Admin Dashboard Metrics

All queries live in `features/dashboard/queries.ts` (C17): `getDashboardKpis(range, clock)`,
`getRevenueSeries(range, granularity, clock)`, `getAppointmentsByService(range, clock)` — the three
functions Section 3 already names. Shapes returned are `KpiSnapshot`, `RevenuePoint[]`,
`ServiceBreakdownPoint[]` (`features/dashboard/types.ts`):

```ts
export type KpiSnapshot = {
  totalPatients: number;
  totalRevenueMinor: number;
  expectedRevenueMinor: number;
  todaysAppointments: number;
  upcomingThisWeek: number;
};
export type RevenuePoint = { bucketKey: string; bucketLabel: string; revenueMinor: number };
export type ServiceBreakdownPoint = { serviceId: string; serviceName: string; colorHex: string; count: number };
```

### 9.1 Shared semantics

| Metric | Anchor timestamp | Status filter | Range-filtered by the picker? |
|---|---|---|---|
| Total patients | — (none; cumulative) | — | No* |
| Total revenue | `startsAtUtc` | `COMPLETED` | Yes |
| Expected revenue | `startsAtUtc` | `CONFIRMED` | No* — forward from `now`, ignores the picker |
| Today's appointments | `startsAtUtc` | `CONFIRMED`, `COMPLETED`, `NO_SHOW` | No* — fixed to today |
| Upcoming this week | `startsAtUtc` | `CONFIRMED` | No* — fixed to this week |
| Revenue over time | `startsAtUtc` | `COMPLETED` | Yes |
| Appointments by service | `startsAtUtc` | `CONFIRMED`, `COMPLETED`, `NO_SHOW` | Yes |

\* **Deviation from the brief**, not an implementation detail — see the callout immediately below.

**Why `startsAtUtc`, never `completedAt`/`confirmedAt`/`createdAt`.** Revenue and appointment counts
answer "how much clinic activity happened/will happen on day X," not "when did an admin click a
button." Anchoring every metric to `startsAtUtc` is also what makes the internal-consistency rule
below true by construction: a KPI and the chart that should sum to it both filter the *same* column
with the *same* status predicate, so partitioning that one filtered set into day/week/month buckets
and re-summing it can never diverge from summing it directly.

**Internal-consistency commitment.** For any range, `Σ(Revenue over time buckets) == Total revenue`,
and `Σ(Appointments by service) == COUNT(Appointment WHERE status IN (CONFIRMED,COMPLETED,NO_SHOW)
AND startsAtUtc IN range)`. Both hold because the chart query and the KPI query share one anchor
column and one status predicate (table above) — the chart is a `GROUP BY` over the exact row set the
KPI `SUM`/`COUNT`s, so no row is double-counted or dropped between the two.

**Deviation from the brief's "applied to all KPIs and charts" (Section 3).** Read literally, a
single picked window can't simultaneously mean "the last 30 days" (Total revenue — backward) and
"today" / "this week" / "upcoming" (three forward- or fixed-looking cards). This plan does **not**
implement the brief literally here, and that is a deviation of the same kind as Section 1 §1.2's
D1–D6, not merely an implementation note: **the picker filters only the metrics for which a
user-chosen historical window is a coherent axis** — Total revenue, Revenue over time, Appointments
by service. Total patients, Today's appointments, Upcoming this week, and Expected revenue are each
already a complete, self-contained window by definition and are left unaffected by the control,
diverging from the brief's literal text. This is the standard pattern on this class of dashboard (a
"today" tile that isn't itself range-filtered) and avoids the alternative's broken default case: a
trailing 30-day window intersected with "upcoming" (`startsAtUtc >= now`) is empty whenever the
window ends at `now`, which would make Expected revenue read 0 under the default range.
**Stakeholder visibility**: this scope narrowing is tracked as Section 1 §1.4's **OQ14** (clock-
anchored cards vs. the shared picker; default: ship the carve-out, both cards stay clock-anchored and
visually marked as such) — see Section 1, §1.4 — so a reader comparing the brief to the plan finds it
as a stated, numbered divergence rather than something Section 9 narrowed silently. It is recorded
here, in full, as the authoritative definition that OQ14's default encodes.

**Half-open intervals, always.** Every range below is `[startLocal, endLocal)` in
`ClinicSettings.timeZone` wall time, converted once via `fromZonedTime` (C6) into
`{ startUtc, endUtc }` (the `DateRange` type lives in `src/server/action.ts`, Section 3). Comparisons
are never done on local calendar strings — only on the resulting UTC instants.

**Default range + presets** (`features/dashboard/schemas.ts`):

```ts
export const dashboardRangeSchema = z.object({
  preset: z.enum(["7d", "30d", "90d", "thisMonth", "custom"]).default("30d"),
  from: z.string().date().optional(), // required iff preset === "custom"
  to: z.string().date().optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});
```

Default `"30d"` resolves to `[tomorrowLocalMidnight - 30d, tomorrowLocalMidnight)` — a 30-calendar-day
window that includes all of today. `"thisMonth"` is `[startOfMonth(today), tomorrowLocalMidnight)`.
`"custom"` takes `from`/`to` dates inclusive, converted the same way.

**Money.** Every sum below is computed in integer minor units over `priceMinorAtBooking`, never
`Service.priceMinor` (C5, C7) — a historical appointment's revenue is immune to a later price edit.
Formatting to a display string happens exactly once, at the component boundary, via
`lib/money.ts formatMoney` — every query in this section returns a plain integer.

**Clock.** Every "now" below comes from the injected `Clock` (C22), never `new Date()`. Worked
examples use `FixedClock("2026-01-15T09:00:00Z")` — exactly `SEED_NOW` from the seed script
(Section 4.6) — so these numbers and Section 11's assertions are the same numbers.

**Sweep independence.** Unlike Section 6's availability reads, no dashboard query needs to run the
hold-expiry sweep first: every count/sum here excludes `PENDING_VERIFICATION` outright (table above),
so a `PENDING_VERIFICATION` row already past `holdExpiresAt` but not yet swept (Section 4.6 seeds two
on purpose) affects zero KPIs either way. Dashboard numbers are deterministic independent of whether
`POST /api/cron/expire-holds` has run recently.

### 9.2 Total patients

**Definition.** The count of `Patient` rows — one per phone number that has completed OTP
verification at least once (C9.6).

- Counts a patient whose **only** appointment is now `CANCELLED` — the `Patient` row was created at
  that appointment's verification (`CONFIRMED`), and `Appointment.patientId` is "set once ... never
  cleared" (C5) regardless of later status changes. A patient's membership in this count is anchored
  to the verification event, not to any appointment's present status.
- Excludes a phone number that only ever reached `PENDING_VERIFICATION` and was abandoned or swept —
  no `Patient` row was ever created for it (C9.6, 4.3.2).
- Not range-filtered (9.1): a running, all-time total, not "patients active in the selected window."

**Date anchor.** None — `Patient` carries no filter condition for this KPI.

```ts
const totalPatients = await db.patient.count();
```

```sql
SELECT COUNT(*) AS total_patients FROM "Patient";
```

**Indexes used.** None beyond the PK/`phoneE164` unique index — an unfiltered `COUNT(*)` at this
table size (A16: a single clinic's realistic volume) is served from the smallest index Postgres has.

**Expected cost.** Index-only scan; effectively O(1) at seeded/production scale.

**Edge cases.** Retention (C20/4.7) hard-deletes a `Patient` with no appointment in the last 24
months — this is a current snapshot, not a historical high-water mark, and can decrease over time.

**Reconciliation (the check this section commits to).**

```sql
SELECT COUNT(DISTINCT "holdPhoneE164") FROM "Appointment" WHERE "patientId" IS NOT NULL;
```

must equal `COUNT(Patient)` exactly, because `patientId` is set only by the phone-keyed upsert at
verification (C9.4) — the same phone always resolves to the same `Patient` row.

**Worked example.** Section 4.6 pins 52 verified appointments (28 `COMPLETED` + 6 `NO_SHOW` + 12
`CONFIRMED` + 6 explicit `CANCELLED`; the other 8 of the seed's 60 rows — 4 `PENDING_VERIFICATION`, 4
hold-expiry `CANCELLED` — never reached verification and are excluded). Section 4 does not pin how
many *distinct* phones those 52 appointments represent; this section fixes that number for exact
test assertions: **45 distinct patients**, 7 of whom book twice (14 appointments) and 38 of whom book
once (38 appointments), `14 + 38 = 52`. One of the 38 singletons is the patient behind the `CANCELLED`
Dental Cleaning appointment on 2026-01-15 (fixture `F4`, 9.5) — originally `CONFIRMED` and verified,
later cancelled, with no other appointment in the seed. Per the inclusion rule above, that patient
still counts. `Total patients = 45`; `COUNT(DISTINCT holdPhoneE164 WHERE patientId IS NOT NULL) = 45`
reconciles exactly.

### 9.3 Total revenue

**Definition.** The sum of `priceMinorAtBooking` over `COMPLETED` appointments whose `startsAtUtc`
falls in the selected range.

- Includes `COMPLETED` only — revenue is recognized when the visit happened and was marked done.
- Excludes `PENDING_VERIFICATION`, `CONFIRMED` (not yet delivered), `CANCELLED` and `NO_SHOW`
  (nothing was delivered in either case).
- Reads `priceMinorAtBooking`, never `Service.priceMinor` (C5).

**Date anchor.** `startsAtUtc`, range `[range.startUtc, range.endUtc)` from the picker (9.1).

```ts
const { _sum } = await db.appointment.aggregate({
  _sum: { priceMinorAtBooking: true },
  where: { status: "COMPLETED", startsAtUtc: { gte: range.startUtc, lt: range.endUtc } },
});
const totalRevenueMinor = _sum.priceMinorAtBooking ?? 0;
```

```sql
SELECT COALESCE(SUM("priceMinorAtBooking"), 0) AS total_revenue_minor
FROM "Appointment"
WHERE status = 'COMPLETED' AND "startsAtUtc" >= $1 AND "startsAtUtc" < $2;
```

**Indexes used.** `@@index([status, startsAtUtc])` — exact composite match; `status='COMPLETED'` is a
highly selective leading predicate (1 of 5 values), then a direct range scan on `startsAtUtc`.

**Expected cost.** Single index range scan; at seed scale, 28 candidate rows total — sub-millisecond,
and the cost stays flat as unrelated statuses accumulate because the index partitions by status first.

**Edge cases.** A `COMPLETED` appointment one minute past the range's upper (exclusive) boundary is
excluded — deliberate, not an off-by-one bug (9.1's half-open rule). v1 has one active currency
(C7); summing across a currency change is out of scope and not modeled.

**Worked example.** Default range `[2025-12-17T00:00, 2026-01-16T00:00)` Europe/Berlin →
`[2025-12-16T23:00:00Z, 2026-01-15T23:00:00Z)`. Ten `COMPLETED` rows fall inside it (full list and
per-bucket breakdown in 9.9's table): **Total revenue = 55,000 minor units (€550.00)**.

### 9.4 Expected revenue

**Definition.** The sum of `priceMinorAtBooking` over `CONFIRMED` appointments whose `startsAtUtc`
is at or after the current instant.

- Includes `CONFIRMED` only, with `startsAtUtc >= clock.now()`.
- Excludes `PENDING_VERIFICATION` (not yet a real booking), `COMPLETED`/`NO_SHOW`/`CANCELLED`
  (already resolved — nothing left to "expect"), and any `CONFIRMED` row whose `startsAtUtc` has
  already passed (administratively unprocessed, but no longer upcoming).
- **"Upcoming" is defined strictly against the `Clock`** (`startsAtUtc >= now`), not against the
  dashboard's date-range picker — see 9.1's resolution.

**Date anchor.** `startsAtUtc >= now`; naturally bounded above by `ClinicSettings.maxAdvanceDays`
(60 days, Section 6) — no `CONFIRMED` row can exist further out than that, so no explicit upper
bound is needed in the query.

```ts
const { _sum } = await db.appointment.aggregate({
  _sum: { priceMinorAtBooking: true },
  where: { status: "CONFIRMED", startsAtUtc: { gte: clock.now() } },
});
const expectedRevenueMinor = _sum.priceMinorAtBooking ?? 0;
```

```sql
SELECT COALESCE(SUM("priceMinorAtBooking"), 0) AS expected_revenue_minor
FROM "Appointment"
WHERE status = 'CONFIRMED' AND "startsAtUtc" >= $1;  -- $1 = clock.now()
```

**Indexes used.** `@@index([status, startsAtUtc])`.

**Expected cost.** Same shape as 9.3; result set is additionally bounded to ≤60 days of booked
capacity by construction.

**Edge cases.** A `CONFIRMED` row exactly at `clock.now()` is included (`>=`). Production reads the
process clock; `FixedClock` makes this deterministic in tests (C22) — no reliance on DB-side `now()`.

**Worked example.** All 12 `CONFIRMED` appointments in the seed have `startsAtUtc >= SEED_NOW`
(2026-01-15T09:00:00Z): 4 land this week (fixtures `F1`, `F2`, `F5`, `F6` — 9.6) summing to 29,000;
the remaining 8, spread through the rest of the 60-day window, sum to 58,500. **Expected revenue =
87,500 minor units (€875.00)**, across 12 appointments.

### 9.5 Today's appointments

**Definition.** The count of appointments with `status IN (CONFIRMED, COMPLETED, NO_SHOW)` whose
`startsAtUtc` falls within today's clinic-local calendar day.

- Includes the three "booked" statuses — a hold that was never confirmed, or a slot that was freed
  by cancellation, isn't a real appointment on today's schedule.
- Excludes `PENDING_VERIFICATION`, `CANCELLED`.
- Not range-filtered (9.1) — always "today," regardless of the picker.

**Date anchor.** `startsAtUtc ∈ [todayStartUtc, todayEndUtc)`, where the boundaries are
`fromZonedTime(todayLocalMidnight, tz)` and `fromZonedTime(tomorrowLocalMidnight, tz)` — **never** a
bare UTC day-floor, or a clinic east/west of UTC sees "today" shifted by its own offset.

```ts
const todaysAppointments = await db.appointment.count({
  where: {
    status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
    startsAtUtc: { gte: todayStartUtc, lt: todayEndUtc },
  },
});
```

```sql
SELECT COUNT(*) AS todays_appointments
FROM "Appointment"
WHERE status IN ('CONFIRMED','COMPLETED','NO_SHOW')
  AND "startsAtUtc" >= $1 AND "startsAtUtc" < $2;
```

**Indexes used.** `@@index([startsAtUtc])` — with 3 of 5 status values matching, the status predicate
is not selective enough for `[status, startsAtUtc]` to beat a plain range scan on `startsAtUtc`
followed by a cheap in-row status filter; unlike 9.3/9.4, status here is the *less* selective side.

**Expected cost.** At most a few dozen rows (one day's worth of slots at 15-minute granularity,
bounded by working hours) — trivial regardless of which index the planner picks.

**Edge cases.** A `CANCELLED` appointment scheduled for today is excluded — demonstrated by the
worked example below. "Today" crossing the UTC day boundary (Europe/Berlin is UTC+1/+2, so clinic-
local midnight is 23:00 or 22:00Z the previous day) must use `fromZonedTime`, never
`startOfDay(startsAtUtc)` on the raw UTC value.

**Worked example.** 2026-01-15 (clinic-local Thursday), window
`[2026-01-14T23:00:00Z, 2026-01-15T23:00:00Z)`:

| Fixture | Status | Service | `startsAtUtc` | Counted? |
|---|---|---|---|---|
| F1 | CONFIRMED | General Consultation | 13:00Z (14:00 local) | Yes |
| F2 | CONFIRMED | Follow-up Visit | 15:30Z (16:30 local) | Yes |
| F3 | COMPLETED | Vaccination | 07:00Z (08:00 local) | Yes |
| F4 | CANCELLED | Dental Cleaning | 10:00Z (11:00 local) | **No** — excluded status |

**Today's appointments = 3.**

### 9.6 Upcoming appointments this week

**Definition.** The count of `CONFIRMED` appointments with `startsAtUtc` at or after now and before
the end of the current clinic-local calendar week.

- **Week definition — assumption, stated once, reused by 9.9's weekly revenue bucket**: an ISO
  calendar week, Monday 00:00 to the following Monday 00:00, clinic-local — not a rolling 7-day
  window. The brief doesn't pin this; calendar-week matches how clinic staff plan a shift roster, and
  one definition serving both this KPI and the weekly chart bucket avoids two different "week"
  semantics in the same dashboard.
- Includes `CONFIRMED` only, same "upcoming against the clock" rule as 9.4, scoped to this week.
- Excludes `COMPLETED`/`NO_SHOW` (already happened), `CANCELLED`, `PENDING_VERIFICATION`.
- Not range-filtered (9.1).
- Intentional overlap: a `CONFIRMED` appointment later today counts in both 9.5 and this KPI — today
  is a subset of this week. The 9.1 consistency rule concerns bucket-sum-equals-KPI, not disjointness
  between unrelated cards.

**Date anchor.** `startsAtUtc ∈ [now, weekEndUtc)`, where `weekEndUtc = fromZonedTime(nextMonday
LocalMidnight, tz)`. `now`, not the week's Monday, is the effective lower bound — a day already past
within this week is not "upcoming."

```ts
const upcomingThisWeek = await db.appointment.count({
  where: { status: "CONFIRMED", startsAtUtc: { gte: clock.now(), lt: weekEndUtc } },
});
```

```sql
SELECT COUNT(*) AS upcoming_this_week
FROM "Appointment"
WHERE status = 'CONFIRMED' AND "startsAtUtc" >= $1 AND "startsAtUtc" < $2;  -- $1 = now, $2 = weekEndUtc
```

**Indexes used.** `@@index([status, startsAtUtc])` — `status='CONFIRMED'` is selective (1 of 5),
composite index earns its keep here.

**Expected cost.** Trivial; at most a week's worth of `CONFIRMED` bookings.

**Edge cases.** A week straddling a month/year boundary (e.g. Dec 29–Jan 4) is still exactly one ISO
week — no special-casing needed; the boundary only matters for the monthly chart bucket (9.9).

**Worked example.** ISO week 2026-01-12–2026-01-19, now = `SEED_NOW` (Jan 15, 09:00Z):

| Fixture | `startsAtUtc` (local) | In week & future? |
|---|---|---|
| F1 | Jan 15, 14:00 | Yes |
| F2 | Jan 15, 16:30 | Yes |
| F5 | Jan 16 (Fri), 09:00 | Yes |
| F6 | Jan 17 (Sat), 10:00 | Yes |

**Upcoming appointments this week = 4.**

### 9.7 Revenue over time (daily / weekly / monthly)

**Definition.** `COMPLETED` revenue, same anchor and filter as 9.3, bucketed by `startsAtUtc` into
clinic-local calendar days, ISO weeks, or calendar months per the UI toggle, for the selected range.

- Same inclusion/exclusion as 9.3 — required for the bucket-sum-equals-total invariant (9.1).
- Range-filtered (9.1), same `range` as 9.3.
- Bucketing mechanics (portability, empty-bucket fill, DST) are 9.9's own subsection.

**Date anchor.** `startsAtUtc`, grouped by a clinic-local calendar key derived from it (9.9) — never
a DB-side `date_trunc`.

```ts
export async function getRevenueSeries(
  range: DateRange, granularity: "day" | "week" | "month", clock: Clock,
): Promise<RevenuePoint[]> {
  const rows = await db.appointment.findMany({
    where: { status: "COMPLETED", startsAtUtc: { gte: range.startUtc, lt: range.endUtc } },
    select: { startsAtUtc: true, priceMinorAtBooking: true },
  });
  return bucketAndFill(rows, range, granularity, settings.timeZone); // 9.9
}
```

```sql
SELECT "startsAtUtc", "priceMinorAtBooking"
FROM "Appointment"
WHERE status = 'COMPLETED' AND "startsAtUtc" >= $1 AND "startsAtUtc" < $2;
-- bucketing happens in application code, not SQL — see 9.9
```

**Indexes used.** `@@index([status, startsAtUtc])` — identical access path to 9.3; this query differs
from 9.3 only in selecting raw rows instead of `SUM`, since the aggregation step moves to TypeScript.

**Expected cost.** Row count is bounded by range and `COMPLETED`-only — at most a few hundred rows
even over a year of a single clinic's volume (A16); well inside the C23 admin budget.

**Edge cases.** See 9.9 (empty buckets, DST-straddling weeks/months).

**Worked example.** See 9.9's table — daily/weekly/monthly series all sum to 55,000, matching 9.3.

### 9.8 Appointments by service

**Definition.** The count of `{CONFIRMED, COMPLETED, NO_SHOW}` appointments per `Service`, by
`startsAtUtc`, within the selected range.

- Same three-status inclusion as 9.5 (the "booked" set), applied here per-service instead of
  clinic-wide.
- Range-filtered (9.1).
- No separate "total appointments" KPI card exists; the per-service counts summing to the filtered
  row count *is* the consistency check (9.1).

**Date anchor.** `startsAtUtc`, range-filtered. No date bucketing — this is a single `GROUP BY
serviceId`, not a time series, so the portability problem in 9.9 doesn't apply here.

```ts
export async function getAppointmentsByService(range: DateRange): Promise<ServiceBreakdownPoint[]> {
  const counts = await db.appointment.groupBy({
    by: ["serviceId"],
    _count: { _all: true },
    where: {
      status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
      startsAtUtc: { gte: range.startUtc, lt: range.endUtc },
    },
  });
  const services = await getActiveServiceCached(); // React cache(), ~7 rows, Section 6.7
  return joinServiceNamesAndColors(counts, services);
}
```

```sql
SELECT "serviceId", COUNT(*) AS appointment_count
FROM "Appointment"
WHERE status IN ('CONFIRMED','COMPLETED','NO_SHOW')
  AND "startsAtUtc" >= $1 AND "startsAtUtc" < $2
GROUP BY "serviceId";
```

**Indexes used.** `@@index([startsAtUtc, status, serviceId])` (A2) — a covering index built for
exactly this shape. Neither `[serviceId, startsAtUtc]` (`serviceId` is a `GROUP BY` key here, not a
filter, so a service-leading index can't lead on it) nor `[status, startsAtUtc]` (status isn't
selective enough across 3-of-5 values to earn the leading position) served this query under the
pre-A2 index list. Leading with `startsAtUtc` serves the range directly, and carrying `status` and
`serviceId` alongside it means every column this query touches — the range filter, the status
filter, and the `GROUP BY` key — is answered from the index alone. `COUNT(*)` needs no column beyond
those three, so Postgres satisfies this query with an **index-only scan**: no heap lookup per row,
only a visibility-map check.

**Expected cost.** Bounded by the range (same row volume as 9.7); the index-only scan removes the
per-row heap fetch entirely, and grouping the ~7-service result in memory is negligible.

**Edge cases.** A service deactivated mid-range (`isActive=false`) still appears in the breakdown if
it has in-range appointments — historical rows never need the `Service` join for name/price (C5's
`...AtBooking` snapshots), only for display name/color here, via the small cached active+inactive
service list.

**Worked example.** Default range `[2025-12-17, 2026-01-16)`, adding fixtures `F1`/`F2` (CONFIRMED,
today, 9.5), `N1` (NO_SHOW, General Consultation, 2025-12-19), `N2` (NO_SHOW, Follow-up Visit,
2026-01-09) to the 10 `COMPLETED` rows from 9.3/9.9:

| Service | Count |
|---|---|
| General Consultation | 5 |
| Follow-up Visit | 4 |
| Vaccination | 2 |
| Dental Cleaning | 1 |
| Physical Therapy Session | 1 |
| Diagnostic Ultrasound | 1 |
| Minor Outpatient Procedure | 0 |
| **Total** | **14** |

Check: 10 `COMPLETED` + 2 `CONFIRMED` (`F1`, `F2`) + 2 `NO_SHOW` (`N1`, `N2`) = 14 — matches the
per-service sum exactly, confirming the 9.1 invariant for this metric.

### 9.9 Bucketing strategy

**The portability problem.** Postgres's `date_trunc('week', "startsAtUtc" AT TIME ZONE $tz)` has no
SQLite equivalent (C3 already bans native `@db.` attributes and provider-specific SQL for this exact
reason). **Pinned approach**: `getRevenueSeries` never buckets in SQL. It fetches the raw, already
range-and-status-filtered `(startsAtUtc, priceMinorAtBooking)` rows (9.7's query — a small result set
by construction) and buckets them in TypeScript with `date-fns-tz`, identically on both providers.

**Trade-off, stated explicitly**: this moves grouping work from the database to the application and
pulls more rows over the wire than a `GROUP BY` would. Acceptable because the row count is bounded by
the same range filter that bounds 9.3 (at most a few hundred rows per A16's volume), and because it is
the only approach that produces byte-identical bucket keys on Postgres dev/CI (SQLite) and prod
(Postgres) — the alternative (two separately-written and separately-tested bucketing queries, one per
provider) is the actual rejected option, not "SQL bucketing" in the abstract.

```ts
function bucketKey(utc: Date, tz: string, granularity: "day" | "week" | "month"): string {
  const local = toZonedTime(utc, tz);
  if (granularity === "day") return formatInTimeZone(utc, tz, "yyyy-MM-dd");
  if (granularity === "month") return formatInTimeZone(utc, tz, "yyyy-MM");
  return formatInTimeZone(startOfWeek(local, { weekStartsOn: 1 }), tz, "yyyy-MM-dd"); // Monday key
}
```

**Empty buckets.** The chart must show zero-revenue days/weeks/months, not gaps. `bucketAndFill`
generates every expected key for `[range.startUtc, range.endUtc)` with `eachDayOfInterval` /
`eachWeekOfInterval` / `eachMonthOfInterval` over the **clinic-local** interval (not the UTC one),
builds a `Map<bucketKey, 0>` seeded with all of them, then overlays the summed real rows on top —
left-join semantics, never an inner join that would silently drop zero-revenue buckets.

**DST-straddling buckets.** A week or month that crosses a DST transition is still exactly one bucket
— the bucket *key* is a clinic-local wall-time label (`"2026-03-30"`, `"2026-W14"`, `"2026-03"`), not
a fixed-width UTC duration. Only the per-row key computation (`formatInTimeZone`, above) needs to be
timezone-aware; a 23-hour or 25-hour local day/week still produces one unambiguous key, so no bucket
is ever split or merged by a transition.

**Worked example (default range, daily/weekly/monthly, from 9.3's 10-row fixture):**

| Date (local) | Service | Amount (minor) |
|---|---|---|
| 2025-12-18 | General Consultation | 5,000 |
| 2025-12-20 | Follow-up Visit | 3,000 |
| 2025-12-23 | Vaccination | 2,500 |
| 2025-12-30 | General Consultation | 5,000 |
| 2026-01-02 | Dental Cleaning | 8,000 |
| 2026-01-05 | Physical Therapy Session | 9,000 |
| 2026-01-08 | Follow-up Visit | 3,000 |
| 2026-01-12 | Diagnostic Ultrasound | 12,000 |
| 2026-01-14 | General Consultation | 5,000 |
| 2026-01-15 | Vaccination | 2,500 |

Weekly roll-up (Mon-start): Dec15–21 = 8,000; Dec22–28 = 2,500; Dec29–Jan4 = 13,000; Jan5–11 =
12,000; Jan12–18 = 19,500 → **55,000**. Monthly roll-up: December = 15,500; January = 39,500 →
**55,000**. Daily sum is the same 10 values → **55,000**. All three granularities reconcile to
9.3's Total revenue, each with zero-value buckets filled for the other 20 days/weeks/months in range
that have no `COMPLETED` row.

### 9.10 Query architecture and caching

**One combined round trip for the four `Appointment`-anchored KPIs**, plus one parallel
`Patient.count()` — not five separate queries, **on the canonical Postgres path**. (The SQLite
fallback takes a different path for this one query — see below.)

Illustrative — the SQL Postgres actually receives once Prisma binds the parameters (`$1`...`$7`
are Postgres's own bound-parameter placeholders, filled in automatically; see `kpiAggregateSql`
below for what is actually written):

```sql
SELECT
  COALESCE(SUM("priceMinorAtBooking") FILTER (
    WHERE status = 'COMPLETED' AND "startsAtUtc" >= $1 AND "startsAtUtc" < $2), 0) AS total_revenue_minor,
  COALESCE(SUM("priceMinorAtBooking") FILTER (
    WHERE status = 'CONFIRMED' AND "startsAtUtc" >= $3), 0)                        AS expected_revenue_minor,
  COUNT(*) FILTER (
    WHERE status IN ('CONFIRMED','COMPLETED','NO_SHOW')
      AND "startsAtUtc" >= $4 AND "startsAtUtc" < $5)                              AS todays_appointments,
  COUNT(*) FILTER (
    WHERE status = 'CONFIRMED' AND "startsAtUtc" >= $6 AND "startsAtUtc" < $7)     AS upcoming_this_week
FROM "Appointment";
```

`FILTER` is standard SQL and SQLite ≥3.30 supports the clause too, but that is not what decides
this query's portability. `kpiAggregateSql(...)` builds a `Prisma.sql`-composed `Sql` object
(Prisma's query builder has no `FILTER` support, so this is the one raw-SQL site, Section 10's
VAL-4) — SQL text as a static template, every date/range value bound through `Prisma.sql`'s own
tagged-template `${}` interpolation, which Prisma parameterizes into the connected provider's
bound-parameter syntax itself. This is **not** string concatenation and is **not**
`$queryRawUnsafe`: Prisma intercepts every `${}` slot in a `Prisma.sql`/tagged-template literal and
sends it as a driver-level bound parameter, injection-safe by construction — VAL-3's ban on
`$queryRawUnsafe`/`$executeRawUnsafe` and on hand-built SQL text is what this call deliberately
stays inside of. (Plain-string-plus-positional-args, by contrast, is exactly `$queryRawUnsafe`'s
signature, not `$queryRaw`'s — `$queryRaw` only ever accepts a tagged-template literal or a
`Prisma.sql`-built `Sql` object, so a plain `string` there is a TypeScript compile error under
strict mode, C2.) What stays Postgres-only is the SQL **text itself**: the `FILTER (WHERE ...)`
aggregate syntax below is written and exercised against Postgres only, and safely binding
parameters is all Prisma does for a raw-SQL call — it does not translate or re-validate that SQL
text for a second provider. **Consequence, stated plainly: this combined aggregate is Postgres-only
by design, not an accident of parameter syntax.** Unlike every per-metric query in 9.3–9.8 — each
built with the Prisma Client query builder, which Prisma *does* translate per provider — this one
raw-SQL site carries no portability claim, and `getDashboardKpis` never issues it against the
SQLite fallback (3.1). See the SQLite path below.

```ts
// The one raw-SQL site (Section 10 VAL-4): a `Prisma.sql`-composed `Sql` object, never a plain
// string. Every `${}` slot is a value, bound safely by Prisma itself — this is the ONLY valid
// form for a `FILTER`-based aggregate `$queryRaw` can run; a plain `string` here is a strict-mode
// (C2) compile error, since `$queryRaw` accepts only a tagged-template literal or a `Prisma.sql`
// `Sql` object, never `(sqlString, ...positionalArgs)` — that signature belongs to
// `$queryRawUnsafe`, which VAL-3 bans outright.
function kpiAggregateSql(
  range: DateRange, now: Date, today: { start: Date; end: Date }, week: { end: Date },
): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COALESCE(SUM("priceMinorAtBooking") FILTER (
        WHERE status = 'COMPLETED' AND "startsAtUtc" >= ${range.startUtc} AND "startsAtUtc" < ${range.endUtc}), 0) AS total_revenue_minor,
      COALESCE(SUM("priceMinorAtBooking") FILTER (
        WHERE status = 'CONFIRMED' AND "startsAtUtc" >= ${now}), 0)                                                AS expected_revenue_minor,
      COUNT(*) FILTER (
        WHERE status IN ('CONFIRMED','COMPLETED','NO_SHOW')
          AND "startsAtUtc" >= ${today.start} AND "startsAtUtc" < ${today.end})                                    AS todays_appointments,
      COUNT(*) FILTER (
        WHERE status = 'CONFIRMED' AND "startsAtUtc" >= ${now} AND "startsAtUtc" < ${week.end})                   AS upcoming_this_week
    FROM "Appointment";
  `;
}

const isSqliteFallback = env.DATABASE_URL.startsWith("file:"); // C3's dev-only fallback; prod is Postgres

export async function getDashboardKpis(range: DateRange, clock: Clock): Promise<KpiSnapshot> {
  const { timeZone } = await getSettingsCached();           // Section 6.7's cache(), reused here
  const now = clock.now();
  const today = todayBoundsUtc(now, timeZone);
  const week = { end: weekEndUtc(now, timeZone) };
  const [agg, totalPatients] = await Promise.all([
    isSqliteFallback
      ? getKpiAggregateViaClient(range, now, today, week)                       // SQLite path, below
      : db.$queryRaw<AggRow[]>(kpiAggregateSql(range, now, today, week))
          .then((rows) => rows[0]),                                             // canonical Postgres path
    db.patient.count(),
  ]);
  return toKpiSnapshot(agg, totalPatients);
}

// SQLite fallback (3.1, C3) only. kpiAggregateSql above is Postgres-only (see above), so this
// computes the same four numbers via four separate Prisma Client calls — the exact query-builder
// shapes already shown in 9.3, 9.4, 9.5 and 9.6 — run concurrently instead of as one round trip.
async function getKpiAggregateViaClient(
  range: DateRange, now: Date, today: { start: Date; end: Date }, week: { end: Date },
): Promise<AggRow> {
  const [revenue, expected, todaysAppointments, upcomingThisWeek] = await Promise.all([
    db.appointment.aggregate({ _sum: { priceMinorAtBooking: true },               // 9.3
      where: { status: "COMPLETED", startsAtUtc: { gte: range.startUtc, lt: range.endUtc } } }),
    db.appointment.aggregate({ _sum: { priceMinorAtBooking: true },               // 9.4
      where: { status: "CONFIRMED", startsAtUtc: { gte: now } } }),
    db.appointment.count({                                                        // 9.5
      where: { status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
        startsAtUtc: { gte: today.start, lt: today.end } } }),
    db.appointment.count({                                                        // 9.6
      where: { status: "CONFIRMED", startsAtUtc: { gte: now, lt: week.end } } }),
  ]);
  return {
    total_revenue_minor: revenue._sum.priceMinorAtBooking ?? 0,
    expected_revenue_minor: expected._sum.priceMinorAtBooking ?? 0,
    todays_appointments: todaysAppointments,
    upcoming_this_week: upcomingThisWeek,
  };
}
```

**Trade-off, stated explicitly**: one `CASE`/`FILTER` aggregate over the whole `Appointment` table
cannot use four different ideal indexes at once — it picks one access path and filters the rest
in-row. At A16's clinic scale (well under a few thousand rows total) a full-table filtered aggregate
costs low-single-digit milliseconds, which is cheaper than the *network* round-trip latency four
separately-indexed queries would add. This should be revisited (split back into the four per-metric
queries in 9.3–9.6, each already shown with its own ideal index) if `Appointment` ever grows past a
single clinic's realistic volume.

**SQLite trade-off, stated explicitly**: `getKpiAggregateViaClient` pays the four separate round
trips the combined aggregate exists to avoid. Acceptable because the SQLite path (C3) is a
disconnected, zero-dependency **dev** fallback only — never prod, never a CI run against the
canonical Postgres schema (3.1) — so this regresses local dev iteration speed, not the C23 budget
below, which is measured against the canonical Postgres path.

**Where it lives**: `features/dashboard/queries.ts` (C17); `getRevenueSeries` and
`getAppointmentsByService` are separate calls with different output shapes, issued by `/admin`'s
`page.tsx` (RSC) via one `Promise.all([getDashboardKpis(...), getRevenueSeries(...),
getAppointmentsByService(...)])` — wall-clock cost is `max()` of the three, not their sum.

**`React.cache()`**: `getSettingsCached()` (Section 6.7) is reused here, not re-implemented — all
three dashboard calls resolve `timeZone` from one request-scoped read, so a single `/admin` render
issues exactly one `ClinicSettings` read regardless of how many of the three functions need it.

**`unstable_cache`: deliberately not used.** `/admin` is `export const dynamic = 'force-dynamic'`
(C15) specifically because every KPI must reflect the latest write — an admin who just marked a visit
`COMPLETED` expects Total revenue to move on the very next page load. Time-based memoization beyond
one request is actively wrong for this feature; the only caching layer in this section is the
per-request `cache()` already covered above.

**Budget fit (C23).** The admin KPI aggregate budget is 400ms p95, measured against the canonical
Postgres path. Two round trips in the KPI path (combined aggregate + patient count, run via
`Promise.all`) plus two more (revenue series, service breakdown) all fire concurrently from one page
render against the pooled connection (`DATABASE_URL`, C23); each is a single bounded,
indexed-or-small-table operation. Comfortably inside budget at A16's volume; this is the first query
path in the plan that should be re-measured if appointment volume materially grows (see the
trade-off above). The SQLite fallback's five round trips (`getKpiAggregateViaClient` plus
`Patient.count()`) are exempt from this budget, per the SQLite trade-off above — dev-only, not the
path C23 is budgeting.

### 9.11 Accuracy test hooks

Exactly what Section 11 should assert against `FixedClock(SEED_NOW)` and the seed fixtures pinned in
this section (9.2–9.9); the "repeat-patient" distribution and specific fixture dates/amounts are this
section's own elaboration of Section 4.6's category totals, introduced because Section 4 pins
category counts but not day-level placement, and KPI accuracy tests need exact numbers.

| Metric | Seeded expected value | Why that number |
|---|---|---|
| Total patients | 45 | `COUNT(Patient)`; 52 verified appointments (9.2) map to 45 distinct phones under this section's 7-repeat / 38-singleton split |
| Total revenue (default 30d range) | 55,000 minor units (€550.00) | Sum of `priceMinorAtBooking` over the 10 pinned `COMPLETED` rows in `[2025-12-16T23:00Z, 2026-01-15T23:00Z)` (9.3) |
| Expected revenue | 87,500 minor units (€875.00) | Sum over all 12 seeded `CONFIRMED` rows, all with `startsAtUtc >= SEED_NOW` (9.4) |
| Today's appointments (2026-01-15) | 3 | `F1`, `F2` (CONFIRMED), `F3` (COMPLETED); `F4` (CANCELLED) correctly excluded (9.5) |
| Upcoming appointments this week (ISO week Jan 12–18) | 4 | `F1`, `F2`, `F5`, `F6` — CONFIRMED and `startsAtUtc >= now` (9.6) |
| Revenue over time — daily/weekly/monthly, default range | 10 / 5 / 2 non-empty buckets, all summing to 55,000 | 9.9's bucket table; asserts the bucket-sum-equals-total invariant across all three granularities |
| Appointments by service, default range | 7 service rows summing to 14 | 9.8's breakdown; no separate "total appointments" KPI exists, so this sum **is** the consistency check |
| Reconciliation: `COUNT(DISTINCT holdPhoneE164 WHERE patientId NOT NULL)` | 45 | Must equal the Total patients row above exactly (9.2) |

#### Contract Challenges

- None. (The prior item here — no composite index served "Appointments by service" (9.8) — is
  resolved: `@@index([startsAtUtc, status, serviceId])` is now in the contract (C24 A2) and in
  Section 4's required-index list, and 9.8 cites it directly.)
