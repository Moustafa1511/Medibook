import { PrismaClient } from "@prisma/client";

import { clinicLocalDate } from "../src/lib/dates";
import { computeOccupiedSlotKeys, resolveWallTime } from "../src/server/slots/availability";

/**
 * Deterministic, idempotent seed. Every row is upserted by a natural key, so
 * re-running this script leaves identical row counts (T3.2) and the KPI
 * assertions in Section 9 can rely on exact numbers.
 *
 * Time is anchored to a constant, never Date.now(), so a seeded fixture is
 * reproducible across machines and CI runs (C22).
 *
 * SEED_NOW anchors the catalog. Appointments, however, are positioned relative
 * to the REAL current date: the clinic only accepts bookings within
 * maxAdvanceDays of today, so appointments pinned to a fixed 2026-01-15 would
 * all be in the past and the calendar would render empty. The seed script is
 * tooling rather than application code, so reading the real clock here is
 * legitimate and the C22 clock ban does not apply to prisma/**.
 */
export const SEED_NOW = new Date("2026-01-15T09:00:00.000Z");

const prisma = new PrismaClient();

const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE ?? "Africa/Cairo";
const CLINIC_CURRENCY = process.env.CLINIC_CURRENCY ?? "EGP";

/** Minutes from midnight in clinic-local wall time. */
const h = (hour: number, minute = 0) => hour * 60 + minute;

/**
 * The Egyptian working week: Friday (weekday 5) is the clinic's day off and
 * gets ZERO rows -- it is NOT Sunday, which is a normal working day here.
 * Saturday through Wednesday run the typical Egyptian private-clinic split
 * shift (morning 10:00-14:00, evening 17:00-21:00); Thursday is deliberately
 * a single morning-only shift so the seeded data exercises both the split-
 * and single-shift paths in the slot engine (Section 4.6).
 *
 * Row count: 5 days x 2 shifts (Sat, Sun, Mon, Tue, Wed) + 1 day x 1 shift
 * (Thu) = 11 rows.
 */
const WORKING_HOURS: ReadonlyArray<{ weekday: number; openMinute: number; closeMinute: number }> = [
  // Friday (5) is closed: it has no rows at all.
  { weekday: 6, openMinute: h(10), closeMinute: h(14) }, // Saturday
  { weekday: 6, openMinute: h(17), closeMinute: h(21) },
  { weekday: 0, openMinute: h(10), closeMinute: h(14) }, // Sunday
  { weekday: 0, openMinute: h(17), closeMinute: h(21) },
  { weekday: 1, openMinute: h(10), closeMinute: h(14) }, // Monday
  { weekday: 1, openMinute: h(17), closeMinute: h(21) },
  { weekday: 2, openMinute: h(10), closeMinute: h(14) }, // Tuesday
  { weekday: 2, openMinute: h(17), closeMinute: h(21) },
  { weekday: 3, openMinute: h(10), closeMinute: h(14) }, // Wednesday
  { weekday: 3, openMinute: h(17), closeMinute: h(21) },
  { weekday: 4, openMinute: h(10), closeMinute: h(14) }, // Thursday: morning only
];

const CLOSED_DATES: ReadonlyArray<{ date: string; reason: string }> = [
  { date: "2026-01-07", reason: "عيد الميلاد المجيد" },
  { date: "2026-01-25", reason: "عيد الشرطة وثورة 25 يناير" },
  { date: "2026-04-25", reason: "عيد تحرير سيناء" },
  { date: "2026-05-01", reason: "عيد العمال" },
  { date: "2026-07-23", reason: "ثورة 23 يوليو" },
  { date: "2026-10-06", reason: "عيد القوات المسلحة" },
  // APPROXIMATE: Islamic (Hijri) holidays are set by moon sighting and shift
  // against the Gregorian calendar every year. These two dates are rough
  // projections for 1447 AH and are NOT authoritative -- confirm the actual
  // dates against the official Egyptian government holiday calendar before
  // launch and update these rows (the reason string also flags this to
  // anyone reading it on the site).
  { date: "2026-03-20", reason: "عيد الفطر (تاريخ تقديري)" },
  { date: "2026-05-27", reason: "عيد الأضحى (تاريخ تقديري)" },
];

const SERVICES: ReadonlyArray<{
  slug: string;
  name: string;
  description: string;
  durationMin: number;
  priceMinor: number;
  sortOrder: number;
  colorHex: string;
}> = [
  {
    slug: "general-consultation",
    name: "استشارة عامة",
    description: "موعد عام لمناقشة الأعراض ومراجعة الأدوية أو الحصول على تحويل لأخصائي.",
    durationMin: 30,
    priceMinor: 30000, // 300 EGP
    sortOrder: 1,
    colorHex: "#0D9488",
  },
  {
    slug: "follow-up-visit",
    name: "زيارة متابعة",
    description: "مراجعة قصيرة لحالة علاج قائم أو نتائج فحوصات حديثة.",
    durationMin: 15,
    priceMinor: 15000, // 150 EGP
    sortOrder: 2,
    colorHex: "#4F46E5",
  },
  {
    slug: "vaccination",
    name: "تطعيم",
    description: "تطعيم دوري أو تطعيم للسفر، بما في ذلك اللقاحات الموسمية.",
    durationMin: 15,
    priceMinor: 20000, // 200 EGP
    sortOrder: 3,
    colorHex: "#0EA5E9",
  },
  {
    slug: "dental-cleaning",
    name: "تنظيف الأسنان",
    description: "تنظيف وتلميع للأسنان مع فحص لصحة الفم.",
    durationMin: 45,
    priceMinor: 50000, // 500 EGP
    sortOrder: 4,
    colorHex: "#16A34A",
  },
  {
    slug: "physical-therapy",
    name: "جلسة علاج طبيعي",
    description: "جلسة فردية لإعادة التأهيل وتحسين الحركة مع أخصائي علاج طبيعي.",
    durationMin: 60,
    priceMinor: 35000, // 350 EGP
    sortOrder: 5,
    colorHex: "#B45309",
  },
  {
    slug: "diagnostic-ultrasound",
    name: "فحص بالموجات فوق الصوتية",
    description: "تصوير تشخيصي غير جراحي مع مراجعة النتائج أثناء الزيارة.",
    durationMin: 45,
    priceMinor: 60000, // 600 EGP
    sortOrder: 6,
    colorHex: "#0369A1",
  },
  {
    slug: "minor-outpatient-procedure",
    name: "إجراء جراحي صغير بالعيادة",
    description: "جلسة أطول لإجراءات صغيرة تُجرى تحت تأثير التخدير الموضعي.",
    durationMin: 90,
    priceMinor: 150000, // 1500 EGP
    sortOrder: 7,
    colorHex: "#A21CAF",
  },
];

/** Reference codes use C8's alphabet (no vowels or look-alikes) and are fixed, so upserts are idempotent. */
const APPOINTMENT_REFS = {
  partlyBooked: ["MB-2S3DKQ", "MB-4H7NPT", "MB-9KRW2M"],
  // Only 4 refs now -- see the fully-booked-day comment in seedAppointments()
  // for why 4 (not the old uniform-hours 6) exactly fills the day.
  fullyBooked: ["MB-3D5FGH", "MB-6J8KMN", "MB-7P9QRS", "MB-8T2VWX"],
  completed: ["MB-GH5JKL", "MB-MN7PQR", "MB-ST9VWY"],
  cancelled: "MB-ZB2CD4",
  noShow: "MB-FG6HJK",
  expiredHold: "MB-LM8NPQ",
} as const;

/**
 * Two now-unused reference codes from this seed's previous (uniform
 * 09:00-18:00) shape, which needed 6 appointments to fill a day. The
 * Egyptian split-shift day only needs 4 (see below), so these are pruned
 * explicitly -- the normal upsert loop only ever touches refs it still
 * knows about, so a stale row like this would otherwise survive forever.
 * AppointmentSlot rows cascade on delete (schema's onDelete: Cascade).
 */
const LEGACY_UNUSED_APPOINTMENT_REFS = ["MB-5Y3ZB4", "MB-2C4DF6"] as const;

/** The next clinic-local date, `fromOffset` days out, whose weekday is open and which is not a holiday. */
function findOpenDate(
  from: Date,
  fromOffset: number,
  timeZone: string,
  openWeekdays: ReadonlySet<number>,
  closedDates: ReadonlySet<string>,
): string {
  for (let offset = fromOffset; offset < fromOffset + 30; offset += 1) {
    const candidate = new Date(from.getTime() + offset * 86_400_000);
    const dateLocal = clinicLocalDate(candidate, timeZone);
    const weekday = new Date(`${dateLocal}T12:00:00Z`).getUTCDay();
    if (openWeekdays.has(weekday) && !closedDates.has(dateLocal)) return dateLocal;
  }
  throw new Error("no open date found within 30 days");
}

interface SeedAppointment {
  reference: string;
  dateLocal: string;
  minutesFromMidnight: number;
  serviceSlug: string;
  status: string;
  fullName: string;
  phoneE164: string;
  holdExpiresAt?: Date;
  withPatient: boolean;
  holdsSlots: boolean;
}

async function seedAppointments(timeZone: string, currency: string) {
  const now = new Date();

  const workingHours = await prisma.workingHour.findMany();
  const openWeekdays = new Set(workingHours.map((row) => row.weekday));
  const closedDates = new Set((await prisma.closedDate.findMany()).map((row) => row.date));
  const services = await prisma.service.findMany();
  const serviceBySlug = new Map(services.map((service) => [service.slug, service]));
  const settings = await prisma.clinicSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  // Three appointments on one morning -> that day reads as partly booked.
  // Shift 1 opens at 10:00 now (not 09:00), so these start there instead.
  const partlyDate = findOpenDate(now, 3, timeZone, openWeekdays, closedDates);

  // A different day filled wall to wall -> that day reads as FULLY BOOKED.
  //
  // Restrict the search to a double-split-shift weekday (Saturday-Wednesday),
  // excluding Thursday's single-shift exception, so the appointment count
  // below is a fixed, known number regardless of which day `now + 7` lands
  // on. Each 240-minute shift (10:00-14:00 or 17:00-21:00) has exactly 11
  // possible 90-minute start times for `minor-outpatient-procedure`
  // (10:00, 10:15, ..., 12:30, stepping by slotIntervalMin=15; a start later
  // than 12:30 would finish after closing). Two back-to-back 90-minute
  // bookings per shift (10:00-11:30 and 11:30-13:00) already occupy every
  // one of those 11 candidates -- the first six (10:00-11:15) overlap
  // booking 1 and the remaining five (11:30-12:30) overlap booking 2. The
  // leftover 13:00-14:00 (or 20:00-21:00) is only 60 minutes, too short for
  // a 90-minute booking to ever start in, booked or not. So 2
  // appointments/shift x 2 shifts = 4 appointments is both necessary and
  // sufficient to fully book such a day.
  const doubleShiftWeekdays = new Set([...openWeekdays].filter((weekday) => weekday !== 4));
  const fullyDate = findOpenDate(now, 7, timeZone, doubleShiftWeekdays, closedDates);

  const pastDate = clinicLocalDate(new Date(now.getTime() - 14 * 86_400_000), timeZone);
  const cancelledDate = findOpenDate(now, 5, timeZone, openWeekdays, closedDates);

  const planned: SeedAppointment[] = [
    ...APPOINTMENT_REFS.partlyBooked.map((reference, index) => ({
      reference,
      dateLocal: partlyDate,
      minutesFromMidnight: h(10) + index * 45,
      serviceSlug: "general-consultation",
      status: "CONFIRMED",
      fullName: ["محمد السيد", "فاطمة علي", "يوسف إبراهيم"][index] ?? "Seed Patient",
      phoneE164: ["+201012345671", "+201112345672", "+201212345673"][index] ?? "+201000000000",
      withPatient: true,
      holdsSlots: true,
    })),
    ...APPOINTMENT_REFS.fullyBooked.map((reference, index) => ({
      reference,
      dateLocal: fullyDate,
      // Shift 1: 10:00, 11:30. Shift 2: 17:00, 18:30 (see comment above).
      minutesFromMidnight: [h(10), h(11, 30), h(17), h(18, 30)][index] ?? h(10),
      serviceSlug: "minor-outpatient-procedure",
      status: "CONFIRMED",
      fullName: `حجز مكتمل ${index + 1}`,
      phoneE164:
        ["+201512345681", "+201512345682", "+201512345683", "+201512345684"][index] ??
        "+201500000000",
      withPatient: true,
      holdsSlots: true,
    })),
    ...APPOINTMENT_REFS.completed.map((reference, index) => ({
      reference,
      dateLocal: pastDate,
      minutesFromMidnight: h(10) + index * 60,
      serviceSlug:
        ["dental-cleaning", "physical-therapy", "diagnostic-ultrasound"][index] ??
        "general-consultation",
      status: "COMPLETED",
      fullName: `مريض سابق ${index + 1}`,
      phoneE164: ["+201012345691", "+201012345692", "+201012345693"][index] ?? "+201000000001",
      withPatient: true,
      holdsSlots: true,
    })),
    {
      reference: APPOINTMENT_REFS.cancelled,
      dateLocal: cancelledDate,
      minutesFromMidnight: h(17, 30),
      serviceSlug: "vaccination",
      status: "CANCELLED",
      fullName: "حجز ملغي",
      phoneE164: "+201112345694",
      withPatient: true,
      // CANCELLED releases its slots, so the time is bookable again (C9/4.4).
      holdsSlots: false,
    },
    {
      reference: APPOINTMENT_REFS.noShow,
      dateLocal: pastDate,
      minutesFromMidnight: h(13),
      serviceSlug: "follow-up-visit",
      status: "NO_SHOW",
      fullName: "لم يحضر",
      phoneE164: "+201112345695",
      withPatient: true,
      holdsSlots: true,
    },
    {
      reference: APPOINTMENT_REFS.expiredHold,
      dateLocal: findOpenDate(now, 10, timeZone, openWeekdays, closedDates),
      minutesFromMidnight: h(11),
      serviceSlug: "general-consultation",
      status: "PENDING_VERIFICATION",
      fullName: "حجز منتهي الصلاحية",
      phoneE164: "+201112345696",
      // Already past: the lazy sweep should cancel this and free the slot.
      holdExpiresAt: new Date(now.getTime() - 60_000),
      withPatient: false,
      holdsSlots: true,
    },
  ];

  // Prune the two appointments this seed no longer creates (see the constant's
  // comment) before upserting what it does create.
  await prisma.appointment.deleteMany({
    where: { reference: { in: [...LEGACY_UNUSED_APPOINTMENT_REFS] } },
  });

  for (const row of planned) {
    const service = serviceBySlug.get(row.serviceSlug);
    if (!service) throw new Error(`unknown service slug: ${row.serviceSlug}`);

    const resolved = resolveWallTime(row.dateLocal, row.minutesFromMidnight, timeZone);
    if (resolved.kind !== "ok") continue;
    const startsAtUtc = resolved.instant;
    const endsAtUtc = new Date(startsAtUtc.getTime() + service.durationMin * 60_000);

    const patient = row.withPatient
      ? await prisma.patient.upsert({
          where: { phoneE164: row.phoneE164 },
          update: { fullName: row.fullName },
          create: { phoneE164: row.phoneE164, fullName: row.fullName },
        })
      : null;

    const data = {
      serviceId: service.id,
      patientId: patient?.id ?? null,
      holdFullName: row.fullName,
      holdPhoneE164: row.phoneE164,
      startsAtUtc,
      endsAtUtc,
      durationMinAtBooking: service.durationMin,
      priceMinorAtBooking: service.priceMinor,
      currencyAtBooking: currency,
      serviceNameAtBooking: service.name,
      status: row.status,
      source: "WEB",
      holdExpiresAt: row.holdExpiresAt ?? null,
      verifiedAt: row.status === "PENDING_VERIFICATION" ? null : startsAtUtc,
      confirmedAt: row.status === "PENDING_VERIFICATION" ? null : startsAtUtc,
      completedAt: row.status === "COMPLETED" ? endsAtUtc : null,
      cancelledAt: row.status === "CANCELLED" ? startsAtUtc : null,
      cancellationReason: row.status === "CANCELLED" ? "PATIENT_REQUEST" : null,
    };

    const appointment = await prisma.appointment.upsert({
      where: { reference: row.reference },
      update: data,
      create: { ...data, reference: row.reference },
    });

    // Rebuild slot rows from the engine's own key maths, so they match exactly
    // what a real booking transaction would insert.
    await prisma.appointmentSlot.deleteMany({ where: { appointmentId: appointment.id } });
    if (row.holdsSlots) {
      const keys = computeOccupiedSlotKeys(
        startsAtUtc,
        service.durationMin,
        settings.bufferMin,
        settings.slotIntervalMin,
      );
      for (const slotStartUtc of keys) {
        // Another seeded appointment may already own this instant; the unique
        // index is the guard, so skip rather than fail the whole seed.
        const taken = await prisma.appointmentSlot.findUnique({ where: { slotStartUtc } });
        if (!taken) {
          await prisma.appointmentSlot.create({
            data: { appointmentId: appointment.id, slotStartUtc },
          });
        }
      }
    }
  }

  // Every patient this seed creates now has an Egyptian +20 number. Any
  // +49 (German) patient row is a leftover from this seed's previous
  // Berlin-based shape; by this point nothing references it (every
  // appointment above was just re-upserted onto a fresh +20 patient), so it
  // is safe to delete.
  await prisma.patient.deleteMany({ where: { phoneE164: { startsWith: "+49" } } });

  return { partlyDate, fullyDate };
}

async function main() {
  const settings = await prisma.clinicSettings.upsert({
    where: { id: "singleton" },
    update: {
      clinicName: "عيادة ميديبوك - المنصورة",
      timeZone: CLINIC_TIMEZONE,
      currency: CLINIC_CURRENCY,
      phoneE164: "+20502301234",
      addressLine1: "12 شارع الجمهورية",
      addressLine2: "المنصورة، الدقهلية، مصر",
      mapUrl: "https://www.openstreetmap.org/?mlat=31.0409&mlon=31.3785#map=17/31.0409/31.3785",
    },
    create: {
      id: "singleton",
      clinicName: "عيادة ميديبوك - المنصورة",
      timeZone: CLINIC_TIMEZONE,
      currency: CLINIC_CURRENCY,
      phoneE164: "+20502301234",
      email: "hello@medibook.example",
      addressLine1: "12 شارع الجمهورية",
      addressLine2: "المنصورة، الدقهلية، مصر",
      mapUrl: "https://www.openstreetmap.org/?mlat=31.0409&mlon=31.3785#map=17/31.0409/31.3785",
    },
  });

  // Prune WorkingHour/ClosedDate rows left over from this seed's previous
  // (German/uniform-hours) shape. Every row's natural key changed along with
  // the schedule itself, so the upsert loops below would never touch them --
  // without this, Friday would still carry its old row and the week would
  // not actually be closed on Friday.
  const canonicalWorkingHourKeys = new Set(
    WORKING_HOURS.map((row) => `${row.weekday}:${row.openMinute}`),
  );
  const staleWorkingHourIds = (await prisma.workingHour.findMany())
    .filter((row) => !canonicalWorkingHourKeys.has(`${row.weekday}:${row.openMinute}`))
    .map((row) => row.id);
  if (staleWorkingHourIds.length > 0) {
    await prisma.workingHour.deleteMany({ where: { id: { in: staleWorkingHourIds } } });
  }

  const canonicalClosedDates = new Set(CLOSED_DATES.map((row) => row.date));
  const staleClosedDateIds = (await prisma.closedDate.findMany())
    .filter((row) => !canonicalClosedDates.has(row.date))
    .map((row) => row.id);
  if (staleClosedDateIds.length > 0) {
    await prisma.closedDate.deleteMany({ where: { id: { in: staleClosedDateIds } } });
  }

  for (const row of WORKING_HOURS) {
    await prisma.workingHour.upsert({
      where: { weekday_openMinute: { weekday: row.weekday, openMinute: row.openMinute } },
      update: { closeMinute: row.closeMinute },
      create: row,
    });
  }

  for (const row of CLOSED_DATES) {
    await prisma.closedDate.upsert({
      where: { date: row.date },
      update: { reason: row.reason },
      create: row,
    });
  }

  for (const row of SERVICES) {
    await prisma.service.upsert({
      where: { slug: row.slug },
      update: { ...row, isActive: true },
      create: { ...row, isActive: true },
    });
  }

  const { partlyDate, fullyDate } = await seedAppointments(settings.timeZone, settings.currency);

  const counts = {
    clinicSettings: await prisma.clinicSettings.count(),
    workingHour: await prisma.workingHour.count(),
    closedDate: await prisma.closedDate.count(),
    service: await prisma.service.count(),
    patient: await prisma.patient.count(),
    appointment: await prisma.appointment.count(),
    appointmentSlot: await prisma.appointmentSlot.count(),
  };
  console.log(`Partly booked day: ${partlyDate}   Fully booked day: ${fullyDate}`);

  console.log(`Seeded at anchor ${SEED_NOW.toISOString()} for ${settings.clinicName}:`, counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
