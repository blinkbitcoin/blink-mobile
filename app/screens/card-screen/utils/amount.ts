import { parseDollarsToCents, toMajorUnit } from "@app/utils/helper"

const numberFormatter = Intl.NumberFormat("en-US")

/** Reads the amount the way it is saved, a comma decimal included, so `350,50` shows as
 *  $350.5 rather than the $0 a plain number reading gave it. Text that is no amount still
 *  shows as $0. */
export const createCurrencyFormatters = (currencySymbol: string) => ({
  formatAmount: (amount: string) =>
    `${currencySymbol}${numberFormatter.format(toMajorUnit(parseDollarsToCents(amount) ?? 0))}`,
})
