/**
 * Single source of truth for locale-dependent formatting.
 *
 * The site is Arabic-only (not bilingual): there is no locale switcher and no
 * i18n framework, which keeps it simple exactly as the brief asks. If a second
 * language is ever needed, this constant is the seam to generalise.
 *
 * NUMERALS: "ar-EG" on its own renders Arabic-Indic digits (٣٠٠٫٠٠ ج.م.). We
 * deliberately pin the Latin numeral system with the `-u-nu-latn` extension, so
 * prices, dates and clock times all use one numeral system — the slot engine
 * emits "HH:mm" in Latin digits, and mixing the two in a single screen reads
 * badly. Latin digits are also the norm in Egyptian digital products.
 * To switch the whole site to Arabic-Indic digits, drop the extension here.
 */
export const LOCALE = "ar-EG-u-nu-latn";

/** The clinic's written language and text direction. */
export const HTML_LANG = "ar";
export const HTML_DIR = "rtl";

/** Weekday order for display: the Egyptian week starts on Saturday. */
export const WEEKDAY_DISPLAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

/** Arabic weekday names, indexed by JS getDay() (0 = Sunday). */
export const WEEKDAY_NAMES_AR: Record<number, string> = {
  0: "الأحد",
  1: "الاثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};
