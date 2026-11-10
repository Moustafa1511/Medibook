import { formatMoney } from "@/lib/money";

export interface MoneyDisplayProps {
  minor: number;
  currency: string;
  locale?: string;
}

/**
 * The only component allowed to render money text directly (8.2.2/8.2.13): a thin
 * wrapper over `formatMoney` (`src/lib/money.ts`, C7). It does no formatting of its own —
 * no `Intl.NumberFormat` call and no hardcoded `/ 100` live here, so a locale or
 * currency-exponent fix in `money.ts` is a fix everywhere this renders. Server Component:
 * stateless, no hook or browser API.
 */
export function MoneyDisplay({ minor, currency, locale }: MoneyDisplayProps) {
  return <span className="tabular-nums">{formatMoney(minor, currency, locale)}</span>;
}
