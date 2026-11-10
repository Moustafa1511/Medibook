## 6. Slot Availability Algorithm

Engine functions live in `src/server/slots/availability.ts` (grid construction and the
availability queries, per Section 3's canonical tree; C17, A9) — `sweepExpiredHolds` (the lazy
and cron sweep) lives in the sibling `src/server/slots/hold-expiry.ts` (C9.5, A9) and is imported
by `availability.ts`. The transactional slot move in 6.5, `rescheduleAppointment`, lives in
`src/server/appointments/reschedule.ts` (C17, A9) and reuses `getFreeSlotsInTx` from
`availability.ts` for its mandatory re-check. Engine functions take an explicit `Clock` (C22), and
are called by thin Server Actions (`action availability.getAvailableDays`,
`action availability.getAvailableSlots`, rate-limited under `availability.read`, C14) and
internally by `booking.createBooking` / `appointments.reschedule`. Engine functions return data or
throw a typed engine error; the `defineAction` wrapper (C12) converts that into `ActionResult<T>`.

### 6.1 Inputs, definitions and invariants

#### Definitions
- **Slot grid**: clinic-local wall-clock minute-marks spaced `slotIntervalMin` apart, anchored at
  each `WorkingHour.openMinute` and stepped forward only within that shift (split shifts stay
  independent grids).
- **Slot-interval**: `ClinicSettings.slotIntervalMin` — the atomic unit of occupancy.
- **Occupied slot key**: a UTC instant that is, or would become, an `AppointmentSlot.slotStartUtc`
  value. Two candidates with the same key are the same slot.
- **Occupied interval**: the contiguous run of slot keys one `Appointment` holds, from
  `startsAtUtc` for `durationSlots` steps.
- **Buffer**: `ClinicSettings.bufferMin`, mandatory gap after a service before the next booking may
  start. **Assumption**: C5's row-count note ("ceil(durationMin / slotIntervalMin) rows") omits
  buffer; this plan generalizes it to `durationSlots = ceil((durationMin + bufferMin) /
  slotIntervalMin)`, identical to C5 when `bufferMin = 0` (the default) but making the buffer real
  `AppointmentSlot` rows guarded by the same unique index as duration, instead of unenforced
  configuration. See Contract Challenges.
- **Lead time**: `ClinicSettings.minLeadTimeMin` — a candidate before `now + minLeadTimeMin` is invalid.
- **Booking window**: clinic-local date range `[today, today + maxAdvanceDays]`.

#### Invariants
1. A returned slot was free at read time only — not reserved. Correctness of the eventual booking
   rests on the DB unique index (6.4), never on the read.
2. No two `AppointmentSlot` rows ever share a `slotStartUtc` value (DB-enforced, C5).
3. All lead-time/window/past comparisons use UTC instants; clinic-local minutes are used only to
   construct a candidate before conversion (C6), never compared across zones directly.
4. A candidate's full occupied interval (duration + buffer) must fit inside one `WorkingHour`
   shift; it never spans the gap of a split day.
5. `slotIntervalMin`, working hours and closed dates are read fresh per call (6.7), never cached
   across requests, since all three can change (6.6).

### 6.2 `getAvailableDays(yearMonth, serviceId)`

Feeds react-day-picker's `disabled` matcher: returns `"YYYY-MM-DD"` strings for days to disable.
The feature layer wraps the array into a `Matcher` function (UI code, out of scope here).

```
function getAvailableDays(yearMonth, serviceId, clock):
  1.  now = clock.now()
  2.  settings = getSettingsCached(); service = getActiveServiceCached(serviceId)
      if !service: return []
  3.  monthStartLocal = yearMonth day 1, 00:00 clinic-local; monthEndLocal = next month day 1, 00:00
  4.  leadHorizonUtc = now + settings.minLeadTimeMin minutes
      maxAdvanceDate = localDate(now, tz) + settings.maxAdvanceDays days
  5.  hoursByWeekday = getWorkingHoursCached()           # Map<0..6, Shift[]>
      closedDateSet  = getClosedDatesCached(monthStartLocal, monthEndLocal)
  6.  sweepExpiredHolds(now)                              # own short tx (UPDATE+DELETE); keeps
                                                             step 7 accurate. 6.3/6.4/6.5 instead
                                                             run it inside their caller's tx.
  7.  occupiedRows = SELECT slotStartUtc FROM AppointmentSlot
         WHERE slotStartUtc >= fromZonedTime(monthStartLocal, tz)
           AND slotStartUtc <  fromZonedTime(monthEndLocal, tz)
      -- ONE range query for the whole month, served by the AppointmentSlot(slotStartUtc)
         unique index. No per-day query -- this is the N+1 avoidance.
  8.  occupiedByDate = {}                                 # Map<"YYYY-MM-DD", Set<UtcInstant>>
      for row in occupiedRows: occupiedByDate[formatInTimeZone(row, tz, "yyyy-MM-dd")].add(row)
  9.  disabled = []
      for d = monthStartLocal .. monthEndLocal - 1 day:
        dateKey = format(d); shifts = hoursByWeekday[weekdayOf(d)]        # [] if closed
        lastCloseUtc = shifts.length ? fromZonedTime(d + closeOf(shifts.last), tz) : null
        reason =
          dateKey < localDate(now, tz)               ? "PAST"            :
          dateKey > maxAdvanceDate                    ? "BEYOND_WINDOW"   :
          dateKey in closedDateSet                     ? "CLOSED_DATE"    :
          shifts.length == 0                           ? "NO_WORKING_HOURS" :
          lastCloseUtc <= leadHorizonUtc                ? "LEAD_TIME"      :  # whole-day fast path
          computeFreeStarts(dateKey, shifts, service, occupiedByDate[dateKey],
                             settings, now).length == 0 ? "FULLY_BOOKED"  : null
        if reason: disabled.push(dateKey)
  10. return disabled
```

`computeFreeStarts` is defined in 6.3 and shared verbatim by both sections, so the "fully booked"
check in 6.2 never issues a second DB query per day — only the one map built there in step 8.

### 6.3 `getAvailableSlots(dateLocal, serviceId)`

Two layers: `computeFreeStarts` is pure, synchronous, DB-free candidate generation, reused by 6.2
(given a pre-fetched occupied set) and by `getFreeSlotsInTx`, which does the DB reads and is itself
reused — inside its *caller's own* transaction — by `createBooking` (6.4) and `rescheduleAppointment`
(6.5) for the mandatory re-check. `getAvailableSlots` is the thin, publicly-exported function that
opens the transaction and runs the sweep first.

```
function computeFreeStarts(dateLocal, shifts, service, occupiedSet, settings, now):
  1. durationSlots = ceil((service.durationMin + settings.bufferMin) / settings.slotIntervalMin)
  2. candidates = []
     for shift in shifts:                                  # {openMinute, closeMinute}
       cursor = shift.openMinute
       while cursor + service.durationMin + settings.bufferMin <= shift.closeMinute:
         wall = dateLocal + "T" + minutesToHHmm(cursor)
         instants = resolveWallTime(wall, settings.timeZone)   # 0, 1 or 2 UTC instants -- note below
         if instants.length > 0: candidates.push({ utc: min(instants) })   # earlier-instant rule
         # instants.length == 0: spring-forward gap; candidate silently dropped
         cursor += settings.slotIntervalMin
     candidates = dedupeByUtcInstant(candidates)   # insurance against two shifts colliding
  3. leadHorizonUtc = now + settings.minLeadTimeMin minutes
     survivors = []
     for c in candidates:
       if c.utc < leadHorizonUtc: continue                  # covers "before now" too
       occupiedKeys = [ c.utc + i*settings.slotIntervalMin min for i in 0..durationSlots-1 ]
       if occupiedKeys.any(k => occupiedSet.has(k)): continue
       survivors.push({ startUtc: c.utc, endUtc: c.utc + service.durationMin min,
                         occupiedKeys, displayLocal: formatInTimeZone(c.utc, settings.timeZone, "HH:mm") })
  4. return survivors

function getFreeSlotsInTx(tx, dateLocal, serviceId, now):    # reused by 6.4 / 6.5, see there
  1. settings = getSettingsCached(tx); service = getActiveServiceCached(tx, serviceId)
     if !service: throw VALIDATION_ERROR
  2. shifts = getWorkingHoursCached(tx)[weekdayOf(dateLocal, settings.timeZone)]
     if shifts.length == 0 or dateLocal in closedDateSet: return []
  3. dayStartUtc = fromZonedTime(dateLocal + "T00:00", settings.timeZone)
     dayEndUtc   = dayStartUtc + 1 day (local)
     occupiedSet = Set(SELECT slotStartUtc FROM AppointmentSlot
                        WHERE slotStartUtc >= dayStartUtc AND slotStartUtc < dayEndUtc)
     -- ONE range scan, same index as 6.2 step 7
  4. return computeFreeStarts(dateLocal, shifts, service, occupiedSet, settings, now)

function getAvailableSlots(dateLocal, serviceId, clock):
  return db.$transaction(async (tx) => {
    now = clock.now()
    sweepExpiredHolds(tx, now)
      -- UPDATE Appointment SET status='CANCELLED', cancellationReason='HOLD_EXPIRED',
           cancelledAt=now WHERE status='PENDING_VERIFICATION' AND holdExpiresAt < now
         RETURNING id                                   # index: (status, holdExpiresAt)
      -- DELETE FROM AppointmentSlot WHERE appointmentId IN (ids above) -- same tx, so
         getFreeSlotsInTx's step 3 already sees the freed keys
    return getFreeSlotsInTx(tx, dateLocal, serviceId, now)
  })
```

`resolveWallTime(wall, tz)` is the single place DST is resolved: both UTC instants when the wall
time is ambiguous (fall-back), one when unambiguous, zero when the wall time has no instant
(spring-forward gap). `min(instants)` implements C6's "prefer the earlier instant" as the
numerically-smallest, chronologically-first UTC value, unambiguous regardless of offset sign.

### 6.4 Committing a booking

```
function createBooking(input, clock):
  appointment = db.$transaction(async (tx) => {
    1. now = clock.now(); sweepExpiredHolds(tx, now)
    2. slots = getFreeSlotsInTx(tx, input.dateLocal, input.serviceId, now)    # 6.3's reusable core
       match = slots.find(s => s.startUtc == input.startUtc)
       if !match: throw SLOT_UNAVAILABLE
    3. reference = generateReference()                                      # C8
    4. appt = INSERT INTO Appointment {
         reference, serviceId: input.serviceId, patientId: null,
         holdFullName: input.fullName, holdPhoneE164: input.phoneE164,
         startsAtUtc: match.startUtc, endsAtUtc: match.endUtc,
         durationMinAtBooking: service.durationMin, priceMinorAtBooking: service.priceMinor,
         currencyAtBooking: settings.currency, serviceNameAtBooking: service.name,
         status: "PENDING_VERIFICATION", source: "WEB",
         holdExpiresAt: now + settings.holdTtlMin minutes }
    5. INSERT INTO AppointmentSlot (appointmentId, slotStartUtc)
         VALUES (appt.id, k) FOR EACH k IN match.occupiedKeys     # P2002 here on collision
    6. return appt
  })
  # on P2002 from step 5: map to err(SLOT_TAKEN); tx already rolled back
  # on success: create OtpChallenge + SmsProvider.sendOtp (C9.3) -- failure -> OTP_SEND_FAILED,
    does NOT roll back the already-committed booking
  return ok({ appointmentId: appointment.id, reference: appointment.reference })
```

#### Why the recheck alone is not sufficient
It only narrows the race window, not closes it. Two concurrent transactions can both read the same
committed snapshot (`READ COMMITTED`), both see the slot free, and both proceed to step 5 — a read
never blocks a later write. The unique index on `slotStartUtc` is what turns "both passed the
check" into "at most one insert commits": the loser's violation is raised by the storage engine
after both already decided to proceed. The recheck only makes the common case (slot taken seconds
ago) fail fast with a clean `SLOT_UNAVAILABLE` before paying for OTP — a UX optimization layered on
the guarantee, not the guarantee itself.

#### Why this matters on a serverless platform
Each invocation is an independent process with no memory or mutex shared across concurrent
requests, which may land on different instances entirely (the same limit C14 states for
`MemoryRateLimiter`). The database is the only component every instance necessarily shares, so it
is the only place a cross-instance invariant ("this slot belongs to one appointment") can live.
"We checked right before we wrote" describes one process's timeline and says nothing about another
process doing the same thing concurrently elsewhere.

### 6.5 Rescheduling

`rescheduleAppointment` lives in `src/server/appointments/reschedule.ts` (C17, A9) — the
transactional slot move, distinct from the grid/availability code in `src/server/slots/`.

```
function rescheduleAppointment(appointmentId, newDateLocal, newStartUtc, actorAdminUserId, clock):
  return db.$transaction(async (tx) => {
    1. now = clock.now()
    2. appt = SELECT * FROM Appointment WHERE id = appointmentId FOR UPDATE
       if !appt: throw NOT_FOUND
       if appt.status != "CONFIRMED": throw INVALID_TRANSITION           # C4
    3. sweepExpiredHolds(tx, now)
    4. slots = getFreeSlotsInTx(tx, newDateLocal, appt.serviceId, now)
       match = slots.find(s => s.startUtc == newStartUtc)
       if !match: throw SLOT_UNAVAILABLE
    5. DELETE FROM AppointmentSlot WHERE appointmentId = appt.id          # old keys freed first
    6. INSERT INTO AppointmentSlot (appointmentId, slotStartUtc)
         VALUES (appt.id, k) FOR EACH k IN match.occupiedKeys            # same P2002 -> SLOT_TAKEN
    7. UPDATE Appointment SET startsAtUtc = match.startUtc, endsAtUtc = match.endUtc,
         rescheduledFromUtc = appt.startsAtUtc, status = "CONFIRMED",    # CONFIRMED->CONFIRMED, C4
         updatedAt = now WHERE id = appt.id
    8. INSERT INTO AuditLog { actorAdminUserId, action: "APPOINTMENT_RESCHEDULED",
         entity: "Appointment", entityId: appt.id,
         metaJson: json({ fromUtc: appt.startsAtUtc, toUtc: match.startUtc }) }   # no PII, C19
    9. return { appointmentId: appt.id, startsAtUtc: match.startUtc }
  })
```

Deleting before inserting means moving onto an overlapping or identical key never self-collides.
Nothing is visible outside this transaction until commit, so a concurrent `createBooking` on a
vacated key either commits first (this transaction's step 6 then correctly raises `SLOT_TAKEN`) or
commits after (sees the new occupant) — resolved purely by commit order, as in 6.4.

### 6.6 Edge cases

| Case | Behaviour | Why | Test |
|---|---|---|---|
| DST spring-forward, wall time doesn't exist | Candidate dropped | zero instants from `resolveWallTime` | FixedClock at transition; minute absent |
| DST fall-back, wall time occurs twice | Earlier UTC instant wins | C6: one deterministic instant | One slot, smallest UTC value, for that minute |
| Service + buffer exceeds remaining shift | Candidate excluded (6.3.7 fit test) | can't run past clinic close | 09-10 shift, 60min total at 09:15 -> excluded |
| Split-shift day | Each shift's own candidates; gap never iterated | loop is per-shift | 2 `WorkingHour` rows; zero slots in the gap |
| Duration not a multiple of `slotIntervalMin` | `ceil((duration+buffer)/interval)` slots; trailing partial slot fully locked | rows are atomic | 50min on 15min grid: 4 rows locked |
| `slotIntervalMin` changed, bookings exist | Old rows keep instants; new candidates use new interval; index still catches overlap | index guards instants, not a grid version | Book on 30min grid, switch to 15min; old instant still excluded |
| Service duration/price changed, bookings exist | Existing rows keep `...AtBooking` snapshots | C5 snapshot fields exist for this | Edit `Service.priceMinor`; history unchanged |
| `ClosedDate` added over existing bookings | Insert succeeds; bookings untouched | closes block new bookings only | Close a date with a `CONFIRMED` booking; it survives |
| Today, lead time cuts into the morning | Day stays enabled if a later slot clears the horizon | day check is whole-day; slot filter is separate | now 08:00, lead 120min, shift 09-17: enabled, <10:00 excluded |
| Day fully booked | Days -> `FULLY_BOOKED`; Slots -> `[]` | empty is valid, not an error | fill every candidate; both agree |
| No active services | Step 1 has no options; engine never called | `serviceId` is required input | deactivate all; steps 2-3 unreachable |
| Clinic closed all week | Every date `NO_WORKING_HOURS` | per-weekday check x7 | delete all `WorkingHour`; 3mo fully disabled |
| Two patients confirm same slot at once | One commits; other's insert -> P2002 -> `SLOT_TAKEN` | index serializes inserts (6.4) | 2 concurrent tx, one key; exactly one succeeds |
| Hold expires mid-wizard (step 3-5) | `verifyOtp` checks own `holdExpiresAt`; expired -> `HOLD_EXPIRED` | sweep may already have freed it | FixedClock past `holdTtlMin`; rebookable by others |
| Clock skew between instances | Never double-books; may shift sweep timing by seconds | guard is the index, not any clock (C22) | not directly testable; covered by clock-independent 6.4/6.5 tests |
| Time zone changed, bookings exist | Stored instants unchanged; only display shifts | UTC storage is non-destructive (C6) | change `timeZone`; `startsAtUtc` same, display differs |

### 6.7 Complexity and performance

| Entry point | Queries | Index(es) | In-memory cost |
|---|---|---|---|
| `getAvailableDays` | 1 range SELECT + cached settings/hours/closed-dates | `AppointmentSlot(slotStartUtc)` (range scan); `ClosedDate(date)` (lexical range) | O(days in month + occupied rows) |
| `getAvailableSlots` | 1 sweep UPDATE+DELETE + 1 range SELECT + cached settings/hours | `Appointment(status, holdExpiresAt)` sweep; `AppointmentSlot(slotStartUtc)` day scan | O(shift min / interval), <=~96/day at 15min |
| `createBooking` | re-check (same tx) + 1 `Appointment` insert + `durationSlots` slot inserts | `AppointmentSlot(slotStartUtc)` unique (the correctness write); `Appointment(reference)` unique | O(durationSlots), typically 1-8 rows |
| `rescheduleAppointment` | re-check + row lock + delete+reinsert slots + `Appointment` update + `AuditLog` insert | `Appointment` PK; `AppointmentSlot(appointmentId)`; `AppointmentSlot(slotStartUtc)` | O(durationSlots) |

**Memoization**: `getSettingsCached`, `getWorkingHoursCached`, `getActiveServiceCached` and the
closed-date set are wrapped in React's `cache()` (C23) per request, so one request calling both
`getAvailableDays` and `getAvailableSlots` never re-fetches settings/hours. The sweep and the
occupied-slot scan are excluded from this cache: both read data the same call may be about to mutate.

**Budget fit (C23)**: `getAvailableSlots` is two small indexed operations plus a bounded loop — well
inside the 120ms p95 budget. `createBooking` adds one `Appointment` insert and a handful of slot
inserts, fitting 250ms p95. Nothing in either path joins tables or scans anything whose cost grows
with total historical appointment count: every query is bounded to "one month" or "one day" against
`AppointmentSlot(slotStartUtc)`, the one index this section's correctness and speed both depend on.

#### Contract Challenges
C5's `AppointmentSlot` row-count note ("ceil(durationMin / slotIntervalMin) rows") omits
`bufferMin`, though `ClinicSettings.bufferMin` is a first-class, documented field. Followed
literally, an implementation would materialize buffer-less rows, leaving `bufferMin` configured but
enforced nowhere — a silent no-op found only once two bookings land back-to-back with no gap.
Section 6 resolves this by generalizing the formula to `ceil((durationMin + bufferMin) /
slotIntervalMin)` (6.1) — identical to C5's text at the shipped default `bufferMin = 0`, so no
behavior changes today — but C5 itself should state the buffer-inclusive formula so it cannot drift
from this section later.
