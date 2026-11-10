/**
 * Hold-expiry sweep (C9.5, A9). A `PENDING_VERIFICATION` appointment whose
 * `holdExpiresAt` has passed is swept to `CANCELLED` (cancellationReason
 * `"HOLD_EXPIRED"`) and its `AppointmentSlot` rows are deleted so the slot
 * becomes bookable again.
 *
 * This runs lazily at the start of every availability read (`getAvailableDays`,
 * `getAvailableSlots` in `availability.ts`) AND is meant to be called by
 * `POST /api/cron/expire-holds` every 5 minutes (C13) — but correctness never
 * depends on the cron actually firing (C9.5): the lazy sweep alone is enough.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import type { Clock } from "@/lib/clock";
import { AppointmentStatus } from "@/lib/enums";
import { db } from "@/server/db";

type QueryClient = PrismaClient | Prisma.TransactionClient;

export interface SweepExpiredHoldsParams {
  readonly clock: Clock;
  /**
   * An existing transaction client to sweep inside of.
   *
   * TRANSACTION CHOICE (documented here because the task explicitly calls for
   * it): `getAvailableSlots`, `createBooking` (Phase 5) and
   * `rescheduleAppointment` (Phase 5) each open their OWN `$transaction` and
   * must see the slots this sweep frees within that same transaction — a
   * commit-then-reread would race a concurrent booking for the same slot
   * between the sweep and the subsequent occupancy read. So when `tx` is
   * given, the sweep runs its two statements against it directly and takes
   * no transaction of its own (Prisma's interactive transactions do not nest).
   *
   * `getAvailableDays`, by contrast, has no enclosing transaction (it is a
   * read-mostly, whole-month query) — so when `tx` is omitted, this function
   * opens a short-lived transaction of its own, keeping the UPDATE and the
   * DELETE atomic together even though nothing bigger wraps them.
   */
  readonly tx?: Prisma.TransactionClient;
}

/**
 * Runs the sweep's two mutating statements (plus one cheap indexed read to
 * collect the affected ids — see below) against whichever client the caller
 * handed us, transactional or not.
 *
 * IMPLEMENTATION CHOICE: the plan's pseudocode (PLAN.md 6.3) sketches this as
 * a single `UPDATE ... RETURNING id` followed by one `DELETE ... WHERE
 * "appointmentId" IN (ids)` — i.e. the ids come free from the UPDATE itself.
 * Prisma's query builder has no `updateMany` equivalent of `RETURNING`, so
 * getting that would require raw SQL (`$queryRaw` with a Postgres-specific
 * `RETURNING` clause), which trades this module's type safety and the C3
 * SQLite-portability goal for saving one indexed lookup on an already-tiny
 * row set (expired-but-unswept holds are bounded by `holdTtlMin`, a handful
 * of rows at most). We take that trade the other way: one `findMany` against
 * the `(status, holdExpiresAt)` index to collect ids, then the `updateMany` +
 * `deleteMany` pair the task asks to keep efficient. Three statements total,
 * all served by an index, none scanning more than the currently-expired set.
 */
async function runSweep(client: QueryClient, now: Date): Promise<string[]> {
  const expired = await client.appointment.findMany({
    where: {
      status: AppointmentStatus.PENDING_VERIFICATION,
      holdExpiresAt: { lt: now },
    },
    select: { id: true },
  });

  if (expired.length === 0) {
    return [];
  }

  const ids = expired.map((row) => row.id);

  await client.appointment.updateMany({
    where: { id: { in: ids } },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancellationReason: "HOLD_EXPIRED",
      cancelledAt: now,
    },
  });

  await client.appointmentSlot.deleteMany({
    where: { appointmentId: { in: ids } },
  });

  return ids;
}

/**
 * Sweep every `PENDING_VERIFICATION` appointment whose hold has expired as of
 * `clock.now()`, freeing its slots. Returns the swept appointment ids (mainly
 * for tests/logging; callers that only need the side effect can ignore it).
 */
export async function sweepExpiredHolds({ clock, tx }: SweepExpiredHoldsParams): Promise<string[]> {
  const now = clock.now();

  if (tx) {
    return runSweep(tx, now);
  }

  return db.$transaction((trx) => runSweep(trx, now));
}
