/**
 * Money formatting and conversion (C7). Every money value elsewhere in the app is an
 * integer MINOR unit (cents, pence, fils, ...); this is the only module allowed to
 * turn one into a display string or convert between major and minor units.
 *
 * The minor-unit exponent is ALWAYS read from
 * `Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits`
 * — never a hardcoded `/ 100` — because it varies by currency: EUR/USD use 2, JPY uses 0,
 * and JOD/KWD use 3. Hardcoding 100 would silently corrupt amounts in the 0- and 3-digit
 * cases.
 */

import { LOCALE } from "@/lib/locale";

function resolveExponent(currency: string, locale: string | undefined): number {
  const { maximumFractionDigits } = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).resolvedOptions();
  // `resolvedOptions()` always defines this for `style: "currency"`; the fallback only
  // satisfies the type checker (it is typed optional for the non-currency styles) and
  // never changes real behaviour.
  return maximumFractionDigits ?? 2;
}

function assertIntegerMinor(minor: number, caller: string): void {
  if (!Number.isInteger(minor)) {
    throw new Error(
      `money.${caller}: expected an integer minor-unit amount, got ${minor}. ` +
        "A fractional minor unit is always a bug upstream (C7) — if you have a major-unit " +
        "value, convert it with majorToMinor() first.",
    );
  }
}

/**
 * Format an integer minor-unit amount as a localized currency string, e.g.
 * `formatMoney(5000, "EUR", "en-GB")` -> `"€50.00"`.
 *
 * NOTE on whitespace: for some locale/currency pairs `Intl` inserts a non-breaking space
 * (U+00A0) or narrow-no-break space (U+202F) between the number and the currency
 * symbol/code (e.g. `"de-DE"` EUR, or `"en-US"` JOD). That is correct typographic
 * output, not a bug — tests assert the exact character rather than normalizing it away.
 */
export function formatMoney(minor: number, currency: string, locale: string = LOCALE): string {
  assertIntegerMinor(minor, "formatMoney");
  const exponent = resolveExponent(currency, locale);
  const major = minor / 10 ** exponent;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(major);
}

/**
 * Convert a decimal major-unit amount (e.g. `50` euros, `5.5` dinars) into the integer
 * minor-unit amount the rest of the app stores, using the same `Intl`-derived exponent as
 * `formatMoney`. Rounds to the nearest minor unit to absorb binary floating-point noise
 * (e.g. `19.9 * 100` is `1989.9999999999998` in IEEE 754).
 */
export function majorToMinor(major: number, currency: string, locale?: string): number {
  if (!Number.isFinite(major)) {
    throw new Error(`money.majorToMinor: expected a finite major-unit amount, got ${major}.`);
  }
  const exponent = resolveExponent(currency, locale);
  return Math.round(major * 10 ** exponent);
}

/** The inverse of `majorToMinor`: integer minor units back to a decimal major-unit amount. */
export function minorToMajor(minor: number, currency: string, locale?: string): number {
  assertIntegerMinor(minor, "minorToMajor");
  const exponent = resolveExponent(currency, locale);
  return minor / 10 ** exponent;
}

/**
 * Sum a list of integer minor-unit amounts as integers — the only arithmetic revenue
 * aggregation is allowed to do (C7: "Revenue sums are computed in minor units as integers
 * and formatted once at the view edge"). Currency-agnostic on purpose: callers are
 * responsible for only summing amounts that share one currency (true for this app, which
 * has exactly one, `ClinicSettings.currency`).
 */
export function sumMinor(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => {
    assertIntegerMinor(amount, "sumMinor");
    return total + amount;
  }, 0);
}
