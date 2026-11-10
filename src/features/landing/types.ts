/**
 * The landing page's narrow, serialisable view of a `Service` row (C17). Deliberately
 * NOT the raw Prisma `Service` model: `ServicesSection` (and its test) are only allowed
 * to depend on this shape, so a column added to the table later for admin-only use
 * (e.g. an internal note) can never leak onto the public page just because a query
 * started selecting it.
 */
export interface ServiceCardView {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** Plain integer minutes (C5) — not a wall-clock time, so it never goes through
   * `@/lib/dates`. Rendered as human text (e.g. "30 min", "1 h 30 min") by the
   * component, never shown as a raw number. */
  readonly durationMin: number;
  /** Integer minor currency units (C7). Only ever rendered via `MoneyDisplay` /
   * `formatMoney` — never divided by 100 or formatted by hand. */
  readonly priceMinor: number;
}
